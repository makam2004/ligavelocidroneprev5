// supabaseClient.js
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('❌ Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY');
}

export default createClient(SUPABASE_URL, SUPABASE_KEY);
