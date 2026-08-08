import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Если переменные не заданы, supabase будет null — приложение покажет
// экран с инструкцией вместо падения с ошибкой.
export const supabase = url && key ? createClient(url, key) : null;
export const supabaseConfigured = Boolean(url && key);
