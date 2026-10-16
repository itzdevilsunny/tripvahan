import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykaorzsoajfwuzibmgoo.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EBLp2hLf7wwcb8aiv-ZqTQ_QzW_nqUU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
