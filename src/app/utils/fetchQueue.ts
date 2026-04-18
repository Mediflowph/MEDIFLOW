/**
 * Centralized Fetch Queue
 * Limits concurrent HTTP requests to prevent ERR_HTTP2_PROTOCOL_ERROR crashes
 * caused by too many simultaneous requests overwhelming the Edge Function.
 */

const MAX_CONCURRENT = 4;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const DEFAULT_TIMEOUT_MS = 90000; // 90 seconds

let activeCount = 0;
const queue: Array<() => void> = [];

function runNext() {
  if (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    activeCount++;
    const next = queue.shift()!;
    next();
  }
}

function enqueue(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queue.push(resolve);
  });
}

function release() {
  activeCount--;
  runNext();
}

/**
 * Queued fetch with concurrency limiting, timeout, and automatic retry.
 * Drop-in replacement for `fetch()`.
 */
export async function queuedFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init || {};
  const externalSignal = fetchInit.signal as AbortSignal | undefined;

  // If already aborted before we even start, bail immediately
  if (externalSignal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  await enqueue();

  // Check again after waiting in queue
  if (externalSignal?.aborted) {
    release();
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // If external signal fires, also abort our internal controller
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort);

      const response = await fetch(input, {
        ...fetchInit,
        signal: controller.signal,
      });

      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      // Retry on 502/503/504 (server overload)
      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < MAX_RETRIES) {
        console.warn(`[fetchQueue] ${response.status} on attempt ${attempt + 1}, retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      release();
      return response;
    } catch (err: any) {
      lastError = err;
      // Don't retry if the external caller aborted
      if (externalSignal?.aborted) break;
      if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.message?.includes('Failed to fetch'))) {
        console.warn(`[fetchQueue] Error on attempt ${attempt + 1}: ${err.message}, retrying...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
    }
  }

  release();
  throw lastError || new Error('queuedFetch failed after retries');
}