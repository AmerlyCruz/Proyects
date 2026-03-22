(function () {
  let supabaseClient = null;

  function getConfig() {
    return window.BEAUTYFAST_SUPABASE_CONFIG || {};
  }

  function getOrdersTable() {
    return getConfig().ordersTable || "orders";
  }

  function getStorageKey() {
    return getConfig().storageKey || "beautyfast.auth";
  }

  function normalizeError(error, fallback) {
    if (!error) return fallback;
    return error.message || fallback;
  }

  window.getBeautyfastSupabase = function getBeautyfastSupabase() {
    if (supabaseClient) return supabaseClient;
    const config = getConfig();
    if (!window.supabase || !config.url || !config.anonKey) return null;

    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: getStorageKey()
      }
    });

    return supabaseClient;
  };

  window.getBeautyfastSession = async function getBeautyfastSession() {
    const client = window.getBeautyfastSupabase();
    if (!client) return { client: null, session: null, user: null };

    const { data, error } = await client.auth.getSession();
    if (error) return { client, session: null, user: null, error };

    return {
      client,
      session: data.session || null,
      user: data.session?.user || null
    };
  };

  window.signUpBeautyfastCustomer = async function signUpBeautyfastCustomer(email, password, metadata) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: "not_configured" };

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {}
      }
    });

    if (error) {
      return { ok: false, reason: "auth_error", error: normalizeError(error, "No pudimos crear la cuenta.") };
    }

    return { ok: true, data };
  };

  window.signInBeautyfastCustomer = async function signInBeautyfastCustomer(email, password) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: "not_configured" };

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, reason: "auth_error", error: normalizeError(error, "No pudimos iniciar sesión.") };
    }

    return { ok: true, data };
  };

  window.signOutBeautyfastCustomer = async function signOutBeautyfastCustomer() {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: "not_configured" };

    const { error } = await client.auth.signOut();
    if (error) {
      return { ok: false, reason: "auth_error", error: normalizeError(error, "No pudimos cerrar sesión.") };
    }

    return { ok: true };
  };

  window.saveBeautyfastOrder = async function saveBeautyfastOrder(order) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: "not_configured" };

    const sessionResult = await window.getBeautyfastSession();
    if (!sessionResult.user) return { ok: false, reason: "not_authenticated" };

    const payload = {
      ...order,
      user_id: sessionResult.user.id,
      email: sessionResult.user.email || order.email
    };

    const { data, error } = await client
      .from(getOrdersTable())
      .insert(payload)
      .select("id, order_number, created_at")
      .single();

    if (error) {
      return { ok: false, reason: "db_error", error: normalizeError(error, "No pudimos guardar el pedido.") };
    }

    return { ok: true, data };
  };

  window.fetchBeautyfastOrders = async function fetchBeautyfastOrders() {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: "not_configured" };

    const sessionResult = await window.getBeautyfastSession();
    if (!sessionResult.user) return { ok: false, reason: "not_authenticated" };

    const { data, error } = await client
      .from(getOrdersTable())
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { ok: false, reason: "db_error", error: normalizeError(error, "No pudimos cargar los pedidos.") };
    }

    return { ok: true, data: data || [], user: sessionResult.user };
  };
})();
