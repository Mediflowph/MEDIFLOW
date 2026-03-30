import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '@/../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseKey = publicAnonKey;

// Create Supabase client with minimal configuration
// The authManager handles concurrency and caching to prevent lock contention
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});