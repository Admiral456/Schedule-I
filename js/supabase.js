const SUPABASE_URL="https://rwrmtuaopbomstjfdlsx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_bkypuR4CQEzSx5G3aodnSw_3_x8af8g";
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
if(!supabaseClient)console.error("Supabase client se nepodařilo načíst.");