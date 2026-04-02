/**
 * Production-safe logger.
 * In production builds all console output is completely suppressed so no
 * internal API paths, tokens, or operational details leak to browser DevTools.
 */

const isDev = import.meta.env.DEV;

// ── Global console suppression in production ───────────────────────────────
if (!isDev && typeof window !== 'undefined') {
  const noop = () => {};
  (window as any).console = {
    ...window.console,
    log:   noop,
    info:  noop,
    warn:  noop,
    debug: noop,
    trace: noop,
    dir:   noop,
    table: noop,
    group: noop,
    groupEnd: noop,
    groupCollapsed: noop,
    // error intentionally suppressed too — no stack traces in prod
    error: noop,
  };
}

// ── Named logger for explicit internal usage ───────────────────────────────
export const logger = {
  log:   (...args: any[]) => { if (isDev) console.log(...args); },
  info:  (...args: any[]) => { if (isDev) console.info(...args); },
  warn:  (...args: any[]) => { if (isDev) console.warn(...args); },
  error: (...args: any[]) => { if (isDev) console.error(...args); },
  debug: (...args: any[]) => { if (isDev) console.debug(...args); },
};
