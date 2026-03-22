window.BEAUTYFAST_SUPABASE_CONFIG = {
  url: "https://xmipcqspotmfljleamcw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaXBjcXNwb3RtZmxqbGVhbWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzYyODcsImV4cCI6MjA4NDUxMjI4N30.602dHefAPXTMcJsz4ncSiqiFHDhWer43SST3RFa8_JU",
  ordersTable: "orders",
  storageKey: "beautyfast.auth"
};

window.isBeautyfastSupabaseConfigured = function isBeautyfastSupabaseConfigured() {
  const config = window.BEAUTYFAST_SUPABASE_CONFIG || {};
  return Boolean(config.url && config.anonKey);
};
