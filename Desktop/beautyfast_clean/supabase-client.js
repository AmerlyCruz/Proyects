(function () {
  let supabaseClient = null;

  function getConfig() {
    return window.BEAUTYFAST_SUPABASE_CONFIG || {};
  }

  function getOrdersTable() {
    return getConfig().ordersTable || "orders";
  }

  function getProductsTable() {
    return getConfig().productsTable || "products";
  }

  function getProfilesTable() {
    return getConfig().profilesTable || "user_profiles";
  }

  function getSettingsTable() {
    return getConfig().settingsTable || "site_settings";
  }

  function getProductImagesBucket() {
    return getConfig().productImagesBucket || "product-images";
  }

  function getStorageKey() {
    return getConfig().storageKey || "beautyfast.auth";
  }

  function getSupabaseAuthStorage() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage;
      }
    } catch (error) {
      return undefined;
    }

    return undefined;
  }

  function clearBeautyfastClientState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('cart');
        window.localStorage.removeItem('beautyfast:last-order');
      }

      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('beautyfast:checkout-order-draft');
      }
    } catch (error) {
      return;
    }
  }

  function normalizeError(error, fallback) {
    if (!error) return fallback;
    return error.message || fallback;
  }

  function normalizeProductPayload(product) {
    const price = Number(product.price || 0);
    const rawOfferPrice = product.offer_price;
    const offerPrice = rawOfferPrice === '' || rawOfferPrice === null || typeof rawOfferPrice === 'undefined'
      ? null
      : Number(rawOfferPrice);

    return {
      name: String(product.name || '').trim(),
      slug: String(product.slug || '').trim(),
      category: String(product.category || 'otros').trim() || 'otros',
      description: String(product.description || '').trim(),
      image_url: String(product.image_url || '').trim(),
      price: Number.isFinite(price) ? price : 0,
      offer_price: Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : null,
      active: product.active !== false,
      out_of_stock: Boolean(product.out_of_stock),
      featured: Boolean(product.featured),
      sort_order: Number.isFinite(Number(product.sort_order)) ? Number(product.sort_order) : 0
    };
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
        storageKey: getStorageKey(),
        storage: getSupabaseAuthStorage()
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

  window.getBeautyfastProfile = async function getBeautyfastProfile() {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const sessionResult = await window.getBeautyfastSession();
    if (!sessionResult.user) return { ok: false, reason: 'not_authenticated' };

    const { data, error } = await client
      .from(getProfilesTable())
      .select('id, email, full_name, role, created_at')
      .eq('id', sessionResult.user.id)
      .maybeSingle();

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos cargar el perfil.') };
    }

    return { ok: true, data: data || null, user: sessionResult.user };
  };

  window.isBeautyfastAdmin = async function isBeautyfastAdmin() {
    const profileResult = await window.getBeautyfastProfile();
    if (!profileResult.ok) {
      return { ok: false, isAdmin: false, reason: profileResult.reason, error: profileResult.error };
    }

    return {
      ok: true,
      isAdmin: profileResult.data?.role === 'admin',
      profile: profileResult.data,
      user: profileResult.user
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

    clearBeautyfastClientState();

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
      if (error.code === '23505' && payload.order_number) {
        const { data: existingOrder, error: existingOrderError } = await client
          .from(getOrdersTable())
          .select('id, order_number, created_at')
          .eq('user_id', sessionResult.user.id)
          .eq('order_number', payload.order_number)
          .maybeSingle();

        if (!existingOrderError && existingOrder) {
          return { ok: true, data: existingOrder, recovered: true };
        }
      }

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

  window.fetchBeautyfastAdminOrders = async function fetchBeautyfastAdminOrders() {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };

    const { data, error } = await client
      .from(getOrdersTable())
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos cargar los pedidos del panel.') };
    }

    return { ok: true, data: data || [] };
  };

  window.updateBeautyfastOrder = async function updateBeautyfastOrder(orderId, updates) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };

    const normalizedOrderId = String(orderId || '').trim();
    if (!normalizedOrderId) {
      return { ok: false, reason: 'validation_error', error: 'El pedido no es válido.' };
    }

    const payload = updates && typeof updates === 'object' ? { ...updates } : {};
    if (!Object.keys(payload).length) {
      return { ok: false, reason: 'validation_error', error: 'No hay cambios para guardar en el pedido.' };
    }

    const { data, error } = await client
      .from(getOrdersTable())
      .update(payload)
      .eq('id', normalizedOrderId)
      .select('*')
      .single();

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos actualizar el pedido.') };
    }

    return { ok: true, data };
  };

  window.fetchBeautyfastProducts = async function fetchBeautyfastProducts(options = {}) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    let query = client
      .from(getProductsTable())
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (options.activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos cargar los productos.') };
    }

    return { ok: true, data: data || [] };
  };

  window.fetchBeautyfastPublicSetting = async function fetchBeautyfastPublicSetting(settingKey) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };
    if (!String(settingKey || '').trim()) {
      return { ok: false, reason: 'validation_error', error: 'La configuración solicitada no es válida.' };
    }

    const { data, error } = await client
      .from(getSettingsTable())
      .select('setting_key, value_json, updated_at')
      .eq('setting_key', String(settingKey).trim())
      .maybeSingle();

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos cargar la configuración pública.') };
    }

    return {
      ok: true,
      data: data?.value_json || null,
      record: data || null
    };
  };

  window.upsertBeautyfastPublicSetting = async function upsertBeautyfastPublicSetting(settingKey, valueJson) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };

    const normalizedKey = String(settingKey || '').trim();
    if (!normalizedKey) {
      return { ok: false, reason: 'validation_error', error: 'La clave de configuración no es válida.' };
    }

    const { data, error } = await client
      .from(getSettingsTable())
      .upsert({
        setting_key: normalizedKey,
        value_json: valueJson && typeof valueJson === 'object' ? valueJson : {}
      }, { onConflict: 'setting_key' })
      .select('setting_key, value_json, updated_at')
      .single();

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos guardar la configuración del catálogo.') };
    }

    return { ok: true, data };
  };

  window.fetchBeautyfastAdminStats = async function fetchBeautyfastAdminStats() {
    const [ordersResult, productsResult] = await Promise.all([
      window.fetchBeautyfastAdminOrders(),
      window.fetchBeautyfastProducts()
    ]);

    if (!ordersResult.ok) return ordersResult;
    if (!productsResult.ok) return productsResult;

    const totalSales = ordersResult.data.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const pendingOrders = ordersResult.data.filter((order) => ['pending', 'pending_payment', 'pending_review', 'processing'].includes(String(order.status || '').toLowerCase())).length;
    const paidOrders = ordersResult.data.filter((order) => ['paid', 'paid_pending_fulfillment', 'shipped', 'delivered', 'completed'].includes(String(order.status || '').toLowerCase()) || String(order.payment_status || '').toLowerCase() === 'paid').length;
    const activeProducts = productsResult.data.filter((product) => product.active !== false).length;

    return {
      ok: true,
      data: {
        totalOrders: ordersResult.data.length,
        totalSales,
        pendingOrders,
        paidOrders,
        totalProducts: productsResult.data.length,
        activeProducts
      }
    };
  };

  window.upsertBeautyfastProduct = async function upsertBeautyfastProduct(product) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };

    const payload = normalizeProductPayload(product);
    if (!payload.name) return { ok: false, reason: 'validation_error', error: 'El producto necesita un nombre.' };
    if (!payload.slug) return { ok: false, reason: 'validation_error', error: 'El producto necesita un slug.' };

    let query;
    if (product.id) {
      query = client
        .from(getProductsTable())
        .update(payload)
        .eq('id', product.id)
        .select('*')
        .single();
    } else {
      query = client
        .from(getProductsTable())
        .insert(payload)
        .select('*')
        .single();
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos guardar el producto.') };
    }

    return { ok: true, data };
  };

  window.bulkUpsertBeautyfastProducts = async function bulkUpsertBeautyfastProducts(products) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };

    if (!Array.isArray(products) || !products.length) {
      return { ok: false, reason: 'validation_error', error: 'No hay productos para importar.' };
    }

    const payload = products
      .map(normalizeProductPayload)
      .filter((product) => product.name && product.slug);

    if (!payload.length) {
      return { ok: false, reason: 'validation_error', error: 'Los productos importados no tienen datos válidos.' };
    }

    const { data, error } = await client
      .from(getProductsTable())
      .upsert(payload, { onConflict: 'slug' })
      .select('*');

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos importar el catálogo.') };
    }

    return { ok: true, data: data || [] };
  };

  window.deleteBeautyfastProduct = async function deleteBeautyfastProduct(productId) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };

    const { error } = await client
      .from(getProductsTable())
      .delete()
      .eq('id', productId);

    if (error) {
      return { ok: false, reason: 'db_error', error: normalizeError(error, 'No pudimos eliminar el producto.') };
    }

    return { ok: true };
  };

  window.uploadBeautyfastProductImage = async function uploadBeautyfastProductImage(file) {
    const client = window.getBeautyfastSupabase();
    if (!client) return { ok: false, reason: 'not_configured' };

    const adminResult = await window.isBeautyfastAdmin();
    if (!adminResult.ok) return adminResult;
    if (!adminResult.isAdmin) return { ok: false, reason: 'forbidden', error: 'Esta cuenta no tiene acceso administrativo.' };
    if (!file) return { ok: false, reason: 'validation_error', error: 'Selecciona una imagen.' };

    const fileExtension = String(file.name || '').split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`;
    const filePath = `products/${fileName}`;

    const { error } = await client
      .storage
      .from(getProductImagesBucket())
      .upload(filePath, file, { upsert: false });

    if (error) {
      return { ok: false, reason: 'storage_error', error: normalizeError(error, 'No pudimos subir la imagen.') };
    }

    const { data } = client.storage.from(getProductImagesBucket()).getPublicUrl(filePath);
    return {
      ok: true,
      data: {
        path: filePath,
        publicUrl: data.publicUrl
      }
    };
  };
})();
