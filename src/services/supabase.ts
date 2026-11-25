import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let currentUrl: string = '';
let currentKey: string = '';

// Built-in Production Supabase Configuration (Cloud Signaling)
const DEFAULT_SUPABASE_URL = 'https://fbbiqkutqbbwduztqczv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_MKq8FyPvotlCe6eH1rlKpw_g4QxKD4l';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  // Check localStorage first, then environment variables, then built-in default
  try {
    const saved = localStorage.getItem('cinemate_supabase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
        };
      }
    }
  } catch (e) {
    // Ignore error
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return {
    url: (envUrl && envUrl.trim()) || DEFAULT_SUPABASE_URL,
    anonKey: (envKey && envKey.trim()) || DEFAULT_SUPABASE_ANON_KEY,
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  try {
    if (url && anonKey) {
      localStorage.setItem('cinemate_supabase_config', JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
    } else {
      localStorage.removeItem('cinemate_supabase_config');
    }
    // Invalidate client cache
    cachedClient = null;
    currentUrl = '';
    currentKey = '';
  } catch (e) {
    console.error('Failed to save Supabase config', e);
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (cachedClient && currentUrl === config.url && currentKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 40,
        },
      },
    });
    currentUrl = config.url;
    currentKey = config.anonKey;
    return cachedClient;
  } catch (err) {
    console.warn('Could not initialize Supabase client:', err);
    return null;
  }
}

