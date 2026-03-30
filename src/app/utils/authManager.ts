import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

/**
 * Centralized Auth Manager
 * Prevents lock contention by managing token access through a single point with caching
 */
class AuthManager {
  private tokenCache: string | null = null;
  private sessionCache: Session | null = null;
  private lastFetchTime: number = 0;
  private pendingRequest: Promise<string | null> | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache (increased from 5s)
  private readonly MAX_RETRIES = 5; // Increased retries
  private readonly INITIAL_RETRY_DELAY = 50; // Shorter initial delay

  /**
   * Get fresh authentication token with caching and retry logic
   */
  async getToken(): Promise<string | null> {
    // Return cached token if still valid
    const now = Date.now();
    if (this.tokenCache && this.sessionCache && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      console.log('🔄 Using cached auth token (age: ' + Math.round((now - this.lastFetchTime) / 1000) + 's)');
      return this.tokenCache;
    }

    // If there's already a pending request, wait for it
    if (this.pendingRequest) {
      console.log('⏳ Waiting for existing token request...');
      return this.pendingRequest;
    }

    // Create new request with retry logic
    this.pendingRequest = this.fetchTokenWithRetry();
    
    try {
      const token = await this.pendingRequest;
      return token;
    } finally {
      this.pendingRequest = null;
    }
  }

  /**
   * Fetch token with exponential backoff retry
   */
  private async fetchTokenWithRetry(): Promise<string | null> {
    let lastError: any = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`⏳ Retry attempt ${attempt}/${this.MAX_RETRIES} after ${delay}ms...`);
          await this.sleep(delay);
        }

        const token = await this.fetchToken();
        if (token) {
          return token;
        }
      } catch (error: any) {
        lastError = error;
        
        // If it's a lock error, retry
        if (error.message?.includes('Lock') || error.message?.includes('lock')) {
          console.warn(`⚠️ Lock contention detected on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        
        // For other errors, don't retry
        console.error('❌ Non-recoverable auth error:', error);
        break;
      }
    }

    console.error('❌ Failed to get token after retries:', lastError);
    return null;
  }

  /**
   * Fetch token from Supabase (single attempt)
   */
  private async fetchToken(): Promise<string | null> {
    try {
      console.log('🔐 Fetching fresh authentication token...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Session error:', error.message);
        throw error;
      }

      if (!session) {
        console.warn('⚠️ No active session found');
        this.clearCache();
        return null;
      }

      // Update cache
      this.tokenCache = session.access_token;
      this.sessionCache = session;
      this.lastFetchTime = Date.now();

      console.log('✅ Token fetched successfully');
      return session.access_token;
    } catch (error) {
      console.error('❌ Error fetching token:', error);
      throw error;
    }
  }

  /**
   * Get current session with caching
   */
  async getSession(): Promise<Session | null> {
    // Return cached session if still valid
    const now = Date.now();
    if (this.sessionCache && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      console.log('🔄 Using cached session');
      return this.sessionCache;
    }

    // Fetch new token (which also updates session cache)
    await this.getToken();
    return this.sessionCache;
  }

  /**
   * Force refresh the token (bypasses cache)
   */
  async refreshToken(): Promise<string | null> {
    console.log('🔄 Force refreshing token...');
    this.clearCache();
    return this.getToken();
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    console.log('🗑️ Clearing auth cache');
    this.tokenCache = null;
    this.sessionCache = null;
    this.lastFetchTime = 0;
  }

  /**
   * Update cache with a new session (used by auth state listener)
   */
  updateCache(session: Session | null): void {
    if (session) {
      this.tokenCache = session.access_token;
      this.sessionCache = session;
      this.lastFetchTime = Date.now();
      console.log('✅ Auth cache updated from listener');
    } else {
      this.clearCache();
    }
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const authManager = new AuthManager();

// Export helper functions for backward compatibility
export const getFreshToken = () => authManager.getToken();
export const getSession = () => authManager.getSession();
export const refreshToken = () => authManager.refreshToken();
export const clearAuthCache = () => authManager.clearCache();