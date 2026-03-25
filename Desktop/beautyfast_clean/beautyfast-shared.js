(function () {
  const CART_STORAGE_KEY = 'cart';
  const MAX_CART_ITEM_QUANTITY = 25;
  const PUBLIC_SETTING_CACHE_PREFIX = 'beautyfast:setting:';
  const CATALOG_CACHE_KEY = 'beautyfast:catalog:resolved';
  const DEFAULT_HOME_SLIDES = Object.freeze([
    Object.freeze({ id: 'hero-slide-1', image_url: 'img/aris hero.jpeg', alt_text: 'Aris Hero', link_url: 'beautyfast.html#capilar', active: true, sort_order: 1 }),
    Object.freeze({ id: 'hero-slide-2', image_url: 'img/linea.jpg', alt_text: 'Línea Capilar', link_url: 'beautyfast.html#capilar', active: true, sort_order: 2 }),
    Object.freeze({ id: 'hero-slide-3', image_url: 'img/shampoo16oz.jpg', alt_text: 'Shampoo 16 OZ', link_url: 'beautyfast.html#individuales', active: true, sort_order: 3 }),
    Object.freeze({ id: 'hero-slide-4', image_url: 'img/TratInt.jpg', alt_text: 'Tratamiento Intensivo', link_url: 'beautyfast.html#individuales', active: true, sort_order: 4 }),
    Object.freeze({ id: 'hero-slide-5', image_url: 'img/gotero4oz.jpg', alt_text: 'Gotero Capilar', link_url: 'beautyfast.html#individuales', active: true, sort_order: 5 }),
    Object.freeze({ id: 'hero-slide-6', image_url: 'img/SupMask.jpg', alt_text: 'Super Mascarilla', link_url: 'beautyfast.html#individuales', active: true, sort_order: 6 })
  ]);

  function cloneValue(value, fallbackValue) {
    try {
      return JSON.parse(JSON.stringify(typeof value === 'undefined' ? fallbackValue : value));
    } catch (error) {
      return typeof fallbackValue === 'undefined' ? null : fallbackValue;
    }
  }

  function getPublicSettingCacheKey(settingKey) {
    return `${PUBLIC_SETTING_CACHE_PREFIX}${String(settingKey || '').trim()}`;
  }

  function getFallbackProducts() {
    if (typeof window.getBeautyfastFallbackProducts === 'function') {
      return window.getBeautyfastFallbackProducts();
    }

    return Array.isArray(window.BEAUTYFAST_FALLBACK_PRODUCTS) ? window.BEAUTYFAST_FALLBACK_PRODUCTS.map((product) => ({ ...product })) : [];
  }

  function getCartStorageKey(options) {
    return options?.storageKey || CART_STORAGE_KEY;
  }

  window.getBeautyfastCachedPublicSetting = function getBeautyfastCachedPublicSetting(settingKey, fallbackValue = null) {
    const normalizedKey = String(settingKey || '').trim();
    if (!normalizedKey) return cloneValue(fallbackValue, fallbackValue);

    try {
      const rawValue = localStorage.getItem(getPublicSettingCacheKey(normalizedKey));
      if (!rawValue) return cloneValue(fallbackValue, fallbackValue);

      return JSON.parse(rawValue);
    } catch (error) {
      localStorage.removeItem(getPublicSettingCacheKey(normalizedKey));
      return cloneValue(fallbackValue, fallbackValue);
    }
  };

  window.setBeautyfastCachedPublicSetting = function setBeautyfastCachedPublicSetting(settingKey, value) {
    const normalizedKey = String(settingKey || '').trim();
    if (!normalizedKey) return;

    localStorage.setItem(getPublicSettingCacheKey(normalizedKey), JSON.stringify(cloneValue(value, {})));
  };

  window.getBeautyfastCachedCatalog = function getBeautyfastCachedCatalog(fallbackValue = null) {
    try {
      const rawValue = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!rawValue) return cloneValue(fallbackValue, fallbackValue);

      return JSON.parse(rawValue);
    } catch (error) {
      localStorage.removeItem(CATALOG_CACHE_KEY);
      return cloneValue(fallbackValue, fallbackValue);
    }
  };

  window.setBeautyfastCachedCatalog = function setBeautyfastCachedCatalog(value) {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cloneValue(value, {})));
  };

  window.getBeautyfastDefaultHomeSlides = function getBeautyfastDefaultHomeSlides() {
    return DEFAULT_HOME_SLIDES.map((slide) => ({ ...slide }));
  };

  window.normalizeBeautyfastHomeSlide = function normalizeBeautyfastHomeSlide(slide, index = 0) {
    const normalizedSortOrder = Number(slide?.sort_order);
    const imageUrl = String(slide?.image_url || slide?.image || '').trim();

    return {
      id: String(slide?.id || `hero-slide-${index + 1}`).trim() || `hero-slide-${index + 1}`,
      image_url: imageUrl,
      alt_text: String(slide?.alt_text || slide?.alt || `Slide ${index + 1}`).trim() || `Slide ${index + 1}`,
      link_url: String(slide?.link_url || slide?.href || 'beautyfast.html').trim() || 'beautyfast.html',
      active: slide?.active !== false,
      sort_order: Number.isFinite(normalizedSortOrder) ? normalizedSortOrder : index + 1
    };
  };

  window.getBeautyfastOfferPercentage = function getBeautyfastOfferPercentage(product) {
    const basePrice = Number(product?.price || 0);
    const offerPrice = Number(product?.offer_price || 0);

    if (!Number.isFinite(basePrice) || !Number.isFinite(offerPrice) || basePrice <= 0 || offerPrice <= 0 || offerPrice >= basePrice) {
      return 0;
    }

    return Math.max(0, Math.round(((basePrice - offerPrice) / basePrice) * 100));
  };

  window.clampBeautyfastCartQuantity = function clampBeautyfastCartQuantity(value) {
    return Math.min(MAX_CART_ITEM_QUANTITY, Math.max(1, Math.floor(Number(value) || 0)));
  };

  window.sanitizeBeautyfastCartItem = function sanitizeBeautyfastCartItem(item, options = {}) {
    if (!item || typeof item !== 'object') return null;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const image = typeof item.image === 'string' ? item.image : String(options.defaultImage || '');
    const price = Number(item.price);
    const quantity = window.clampBeautyfastCartQuantity(item.quantity);

    if (!name || !Number.isFinite(price) || price < 0) return null;

    return { name, image, price, quantity };
  };

  window.loadBeautyfastStoredCart = function loadBeautyfastStoredCart(options = {}) {
    const storageKey = getCartStorageKey(options);
    const rawCart = localStorage.getItem(storageKey);
    if (!rawCart) return [];

    try {
      const parsedCart = JSON.parse(rawCart);
      if (!Array.isArray(parsedCart)) throw new Error('Invalid cart payload');

      const sanitizedCart = parsedCart
        .map((item) => window.sanitizeBeautyfastCartItem(item, options))
        .filter(Boolean);

      if (sanitizedCart.length !== parsedCart.length) {
        localStorage.setItem(storageKey, JSON.stringify(sanitizedCart));
      }

      return sanitizedCart;
    } catch (error) {
      localStorage.removeItem(storageKey);
      return [];
    }
  };

  window.saveBeautyfastStoredCart = function saveBeautyfastStoredCart(items, options = {}) {
    const storageKey = getCartStorageKey(options);
    localStorage.setItem(storageKey, JSON.stringify(Array.isArray(items) ? items : []));
  };

  window.getBeautyfastCatalogCurrentPrice = function getBeautyfastCatalogCurrentPrice(product) {
    const basePrice = Number(product?.price || 0);
    const offerPrice = Number(product?.offer_price || 0);
    if (Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < basePrice) return offerPrice;
    return basePrice;
  };

  window.resolveBeautyfastCatalog = async function resolveBeautyfastCatalog(options = {}) {
    const normalizeProduct = typeof options.normalizeProduct === 'function' ? options.normalizeProduct : ((product) => product);
    const mergeKey = options.mergeKey || 'slug';
    const fallbackProducts = getFallbackProducts().map(normalizeProduct).filter((product) => product?.name);
    const cachedCatalog = typeof window.getBeautyfastCachedCatalog === 'function'
      ? window.getBeautyfastCachedCatalog({ products: [], catalogMode: '' })
      : { products: [], catalogMode: '' };
    const cachedRemoteProducts = Array.isArray(cachedCatalog?.products)
      ? cachedCatalog.products.map(normalizeProduct).filter((product) => product?.name)
      : [];

    function buildCatalogResult(remoteProducts, catalogMode, sourceOverride) {
      if (catalogMode === 'supabase') {
        return { products: remoteProducts, source: sourceOverride || 'supabase' };
      }

      const mergedProducts = new Map(fallbackProducts.map((product) => [String(product?.[mergeKey] || product?.name || ''), product]));
      remoteProducts.forEach((product) => {
        mergedProducts.set(String(product?.[mergeKey] || product?.name || ''), product);
      });

      return {
        products: [...mergedProducts.values()].sort((left, right) => {
          const leftSort = Number(left?.sort_order);
          const rightSort = Number(right?.sort_order);
          if (Number.isFinite(leftSort) && Number.isFinite(rightSort) && leftSort !== rightSort) {
            return leftSort - rightSort;
          }
          return String(left?.name || '').localeCompare(String(right?.name || ''));
        }),
        source: sourceOverride || (remoteProducts.length >= fallbackProducts.length ? 'supabase' : 'hybrid')
      };
    }

    if (!window.fetchBeautyfastProducts || !window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      return { products: fallbackProducts, source: 'fallback' };
    }

    const [result, catalogSettingResult] = await Promise.all([
      window.fetchBeautyfastProducts({ activeOnly: options.activeOnly !== false }),
      typeof window.fetchBeautyfastPublicSetting === 'function'
        ? window.fetchBeautyfastPublicSetting('catalog_source')
        : Promise.resolve({ ok: false, data: null })
    ]);

    const catalogMode = catalogSettingResult.ok
      ? String(catalogSettingResult.data?.mode || '').trim().toLowerCase()
      : String(cachedCatalog?.catalogMode || '').trim().toLowerCase();

    if (!result.ok || !Array.isArray(result.data) || !result.data.length) {
      if (cachedRemoteProducts.length) {
        return buildCatalogResult(cachedRemoteProducts, catalogMode, 'cache');
      }

      if (catalogMode === 'supabase' && result.ok) {
        return { products: [], source: 'supabase', empty: true };
      }

      return { products: fallbackProducts, source: 'fallback', error: result.error };
    }

    const remoteProducts = result.data.map(normalizeProduct).filter((product) => product?.name);
    if (typeof window.setBeautyfastCachedCatalog === 'function') {
      window.setBeautyfastCachedCatalog({
        products: result.data,
        catalogMode,
        cachedAt: new Date().toISOString()
      });
    }

    return buildCatalogResult(remoteProducts, catalogMode);
  };

  window.syncBeautyfastCartWithCatalog = function syncBeautyfastCartWithCatalog(cartItems, catalogProducts, options = {}) {
    const sanitizedItems = Array.isArray(cartItems)
      ? cartItems.map((item) => window.sanitizeBeautyfastCartItem(item, options)).filter(Boolean)
      : [];
    const catalogByName = new Map((catalogProducts || []).map((product) => [product.name, product]));
    let hasChanges = sanitizedItems.length !== (Array.isArray(cartItems) ? cartItems.length : 0);

    const items = sanitizedItems.flatMap((item) => {
      const nextQuantity = window.clampBeautyfastCartQuantity(item.quantity);
      const product = catalogByName.get(item.name);
      const nextItem = {
        ...item,
        quantity: nextQuantity
      };

      if (nextQuantity !== item.quantity) {
        hasChanges = true;
      }

      if (!product) {
        return [nextItem];
      }

      if (product.active === false || product.out_of_stock === true) {
        hasChanges = true;
        return [];
      }

      const nextPrice = window.getBeautyfastCatalogCurrentPrice(product);
      const nextImage = String(product.image || product.image_url || nextItem.image || options.defaultImage || '');

      if (nextPrice !== nextItem.price || nextImage !== nextItem.image) {
        hasChanges = true;
      }

      return [{
        ...nextItem,
        price: nextPrice,
        image: nextImage
      }];
    });

    return { items, hasChanges };
  };
})();