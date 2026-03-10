/**
 * Cliente Supabase para backend (Vercel serverless).
 * Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * No usar anon key: necesitamos service_role para leer/escribir orders con RLS.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

export function ordersTable() {
  if (!supabase) throw new Error("Supabase no configurado");
  return supabase.from("orders");
}
