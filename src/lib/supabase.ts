import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please click the "Connect to Supabase" button in the top right corner.');
}

// Create a singleton instance
let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      flowType: 'pkce'
    },
    global: {
      headers: {
        'X-Client-Info': 'worship-present'
      }
    },
    db: {
      schema: 'public'
    }
  });

  // Enhanced error handling for auth state changes
  supabaseInstance.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      // Clear all local storage data on sign out
      localStorage.clear();
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (!session?.access_token) {
        console.error('Invalid session detected');
        supabaseInstance?.auth.signOut().catch(console.error);
      }
    }
  });

  return supabaseInstance;
}

// Export the singleton instance
export const supabase = createSupabaseClient();

// Helper function to handle common Supabase errors
export const handleSupabaseError = (error: any): string => {
  console.error('Supabase error:', error);

  if (typeof error === 'string') {
    return error;
  }

  if (error?.message?.includes('JWT expired')) {
    // Force sign out on JWT expiration
    supabase.auth.signOut().catch(console.error);
    return 'Your session has expired. Please sign in again.';
  }

  if (error?.message?.includes('authentication failed')) {
    supabase.auth.signOut().catch(console.error);
    return 'Authentication failed. Please sign in again.';
  }

  if (error?.code === 'PGRST116') {
    return 'User profile not found. Please complete registration.';
  }

  return error?.message || 'An unexpected error occurred';
};

// Helper to check auth status
export const checkAuth = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('No active session');
  return session;
};

// Helper to refresh session
export const refreshSession = async () => {
  const { data: { session }, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  if (!session) throw new Error('Failed to refresh session');
  return session;
};