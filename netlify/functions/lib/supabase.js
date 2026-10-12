const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ptmuzfudxtfmnbqvfquh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_4s_9vcfp6lvuFE1txQ5TfA_2iIfn_fQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = supabase;
