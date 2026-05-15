import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pbfxorfiwhmzinkwumwt.supabase.co";
const supabaseAnonKey = "sb_publishable_tA9Hl-rwctqQDwvFVMYCLQ_TE4rwF_o";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
