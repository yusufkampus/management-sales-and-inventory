import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Helper function to perform authenticated fetch requests to the Express backend
 */
export async function apiFetch(endpoint, options = {}) {
  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    throw new Error('Not authenticated');
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}
