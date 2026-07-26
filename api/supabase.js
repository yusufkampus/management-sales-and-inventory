const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
}

const WebSocket = require('ws');

// Create a single supabase client for interacting with your database
const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder", {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    WebSocket
  }
});

module.exports = supabase;
