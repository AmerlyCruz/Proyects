// Espera a que el DOM cargue antes de ejecutar el JS
document.addEventListener("DOMContentLoaded", async function () {

// change this variable to update business name site-wide
const BUSINESS_NAME = "El Secreto de Aris";

console.log("JS conectado correctamente");

// update header brand text once the current DOM is ready
const brandLink = document.querySelector('.brand-link');
if (brandLink) brandLink.textContent = BUSINESS_NAME;

// -------- TOGGLE SEARCH BOX --------
const searchToggle = document.getElementById('searchToggle');
const searchInput = document.getElementById('search');
const clearSearchBtn = document.getElementById('clearSearch');
const searchBox = document.querySelector('.search-box');

if (searchToggle && searchInput && clearSearchBtn) {
  searchToggle.addEventListener('click', () => {
    const isOpen = searchBox?.classList.contains('search-open');

    if (isOpen) {
      searchInput.value = '';
      searchInput.classList.remove('active');
      clearSearchBtn.classList.remove('show');
      if (searchBox) searchBox.classList.remove('search-open');
      searchInput.dispatchEvent(new Event('input'));
      searchInput.blur();
      return;
    }

    if (searchBox) searchBox.classList.add('search-open');
    searchInput.classList.add('active');
    searchInput.focus();
  });

  // Listen for search input to show/hide clear button AND filter products
  searchInput.addEventListener('input', function() {
    // Show/hide clear button
    if (searchInput.value.length > 0) {
      clearSearchBtn.classList.add('show');
    } else {
      clearSearchBtn.classList.remove('show');
    }

    handleStorefrontSearch(searchInput.value);
  });

  searchInput.addEventListener('blur', () => {
    if (searchInput.value.length === 0) {
      searchInput.classList.remove('active');
      if (searchBox) searchBox.classList.remove('search-open');
    }
  });

  // close search when user presses Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.classList.remove('active');
      clearSearchBtn.classList.remove('show');
      if (searchBox) searchBox.classList.remove('search-open');
      searchInput.blur();
      searchInput.dispatchEvent(new Event('input'));
    }
  });
}

// ------------ Carrito ----------------
const MAX_CART_ITEM_QUANTITY = 25;
const HOME_SLIDER_SETTING_KEY = 'home_slider';
const HOME_TESTIMONIALS_SETTING_KEY = 'home_testimonials';
const HOME_FAQ_SETTING_KEY = 'home_faq';
const STOCK_VISIBILITY_SETTING_KEY = 'storefront_stock_visibility';
const PUBLIC_SETTING_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const CATALOG_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const SWIPER_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
const SWEETALERT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
const WELCOME_MODAL_SEEN_KEY = 'beautyfast:welcome-modal-seen';
const WELCOME_MODAL_DISMISSED_SESSION_KEY = 'beautyfast:welcome-modal-dismissed';

function sanitizeCartItem(item) {
  if (typeof window.sanitizeBeautyfastCartItem === 'function') {
    return window.sanitizeBeautyfastCartItem(item);
  }

  return null;
}

function clampCartQuantity(value) {
  if (typeof window.clampBeautyfastCartQuantity === 'function') {
    return window.clampBeautyfastCartQuantity(value);
  }

  return Math.min(MAX_CART_ITEM_QUANTITY, Math.max(1, Math.floor(Number(value) || 0)));
}

function loadStoredCart() {
  if (typeof window.loadBeautyfastStoredCart === 'function') {
    return window.loadBeautyfastStoredCart();
  }

  return [];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let cart = loadStoredCart();
let storefrontSessionState = {
  isAdmin: false,
  user: null,
  profile: null
};
let swiperLoadPromise = null;
let sweetAlertLoadPromise = null;

function isAdminStorefrontSession() {
  return Boolean(storefrontSessionState.isAdmin);
}

function runWhenStorefrontIdle(task, timeout = 900) {
  return new Promise((resolve) => {
    const executeTask = () => {
      Promise.resolve()
        .then(task)
        .catch(() => null)
        .finally(resolve);
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(executeTask, { timeout });
      return;
    }

    window.setTimeout(executeTask, 80);
  });
}

function loadScriptOnce(url, dataAttributeName) {
  const selector = `script[data-${dataAttributeName}="true"]`;
  const existingScript = document.querySelector(selector);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`No pudimos cargar ${url}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset[dataAttributeName] = 'true';
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`No pudimos cargar ${url}`)), { once: true });
    document.body.appendChild(script);
  });
}

function ensureSweetAlertReady() {
  if (window.Swal?.fire) {
    return Promise.resolve(window.Swal);
  }

  if (sweetAlertLoadPromise) {
    return sweetAlertLoadPromise;
  }

  sweetAlertLoadPromise = loadScriptOnce(SWEETALERT_SCRIPT_URL, 'sweetalertLoader')
    .then(() => window.Swal)
    .catch((error) => {
      sweetAlertLoadPromise = null;
      throw error;
    });

  return sweetAlertLoadPromise;
}

function fireStorefrontAlert(options) {
  return ensureSweetAlertReady()
    .then((sweetAlert) => sweetAlert.fire(options))
    .catch(() => {
      if (!options?.toast) {
        window.alert(String(options?.text || options?.title || 'Ocurrio un aviso en la tienda.'));
      }
      return null;
    });
}

function observeElementOnce(element, callback, options = {}) {
  if (!element || typeof callback !== 'function') return () => {};

  let hasRun = false;
  const runCallback = () => {
    if (hasRun) return;
    hasRun = true;
    callback();
  };

  if (typeof window.IntersectionObserver !== 'function') {
    runWhenStorefrontIdle(runCallback, options.timeout || 1200);
    return () => {};
  }

  const observer = new window.IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      runCallback();
    });
  }, {
    rootMargin: options.rootMargin || '240px 0px',
    threshold: options.threshold || 0.01
  });

  observer.observe(element);
  return () => observer.disconnect();
}

function ensureSwiperReady() {
  if (typeof window.Swiper === 'function') {
    return Promise.resolve(window.Swiper);
  }

  if (swiperLoadPromise) {
    return swiperLoadPromise;
  }

  swiperLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-swiper-loader="true"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Swiper), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('No pudimos cargar Swiper.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = SWIPER_SCRIPT_URL;
    script.async = true;
    script.dataset.swiperLoader = 'true';
    script.addEventListener('load', () => resolve(window.Swiper), { once: true });
    script.addEventListener('error', () => reject(new Error('No pudimos cargar Swiper.')), { once: true });
    document.body.appendChild(script);
  }).catch((error) => {
    swiperLoadPromise = null;
    throw error;
  });

  return swiperLoadPromise;
}

function scheduleHeroSwiperMount() {
  return runWhenStorefrontIdle(async () => {
    try {
      await ensureSwiperReady();
      mountHomeHeroSwiper();
    } catch (error) {
      console.warn('No pudimos montar el carrusel principal.', error);
    }
  });
}

function scheduleTestimonialsSwiperMount() {
  return runWhenStorefrontIdle(async () => {
    try {
      await ensureSwiperReady();
      mountHomeTestimonialsSwiper();
    } catch (error) {
      console.warn('No pudimos montar el carrusel de testimonios.', error);
    }
  });
}

function hideElement(element) {
  if (!element) return;
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
  element.style.display = 'none';
}

function showElement(element, displayValue = '') {
  if (!element) return;
  element.hidden = false;
  element.removeAttribute('aria-hidden');
  element.style.display = displayValue;
}

async function resolveStorefrontSessionState() {
  if (!window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
    storefrontSessionState = { isAdmin: false, user: null, profile: null };
    return storefrontSessionState;
  }

  const sessionResult = await window.getBeautyfastSession();
  if (!sessionResult.user) {
    storefrontSessionState = { isAdmin: false, user: null, profile: null };
    return storefrontSessionState;
  }

  const adminResult = window.isBeautyfastAdmin ? await window.isBeautyfastAdmin() : { ok: false, isAdmin: false };
  storefrontSessionState = {
    isAdmin: Boolean(adminResult.ok && adminResult.isAdmin),
    user: sessionResult.user,
    profile: adminResult.profile || null
  };

  return storefrontSessionState;
}

function getStorefrontDisplayName() {
  const profileName = String(storefrontSessionState.profile?.full_name || '').trim();
  if (profileName) return profileName;

  const email = String(storefrontSessionState.user?.email || '').trim();
  if (!email) return 'Mi cuenta';

  return email.split('@')[0] || email;
}

function renderHeaderAccount() {
  const headerAccount = document.getElementById('headerAccount');
  if (!headerAccount) return;

  if (isAdminStorefrontSession()) {
    headerAccount.innerHTML = `
      <a href="admin.html" class="header-account-button" aria-label="Abrir gestion de la tienda">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" fill="currentColor"></path>
        </svg>
        <span class="header-account-label">Gestion</span>
      </a>
    `;
    return;
  }

  if (storefrontSessionState.user) {
    headerAccount.innerHTML = `
      <a href="orders.html" class="header-account-button" aria-label="Abrir mi cuenta">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" fill="currentColor"></path>
        </svg>
        <span class="header-account-label">${escapeHtml(getStorefrontDisplayName())}</span>
      </a>
    `;
    return;
  }

  const storedProfileName = typeof window.getBeautyfastProfileDisplayName === 'function'
    ? window.getBeautyfastProfileDisplayName()
    : '';

  headerAccount.innerHTML = `
    <button type="button" class="header-account-button header-account-trigger" aria-label="Abrir acceso rápido">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" fill="currentColor"></path>
      </svg>
      <span class="header-account-label">${escapeHtml(storedProfileName || 'Acceso')}</span>
    </button>
  `;

  const trigger = headerAccount.querySelector('.header-account-trigger');
  if (trigger) {
    trigger.addEventListener('click', openWelcomeModal);
  }
}

function applyStorefrontSessionMode() {
  const footerOrderLinks = document.querySelectorAll('a[href="orders.html"].footer-link-pill');
  const homeContactSection = document.getElementById('homeContactSection');
  const cartElements = [
    document.querySelector('.cart'),
    document.getElementById('cartPanel'),
    document.getElementById('cartOverlay')
  ];

  renderHeaderAccount();

  if (!isAdminStorefrontSession()) {
    footerOrderLinks.forEach((link) => showElement(link, ''));
    cartElements.forEach((element, index) => showElement(element, index === 0 ? 'flex' : ''));
    if (productModalAddCartBtn) showElement(productModalAddCartBtn, 'inline-flex');
    showElement(homeContactSection, '');
    if (typeof window.prefillBeautyfastContactFields === 'function') {
      window.prefillBeautyfastContactFields(document);
    }
    return;
  }

  cart = [];
  saveCart();
  updateCartCount();
  closeCartPanel();
  footerOrderLinks.forEach((link) => hideElement(link));
  cartElements.forEach((element) => hideElement(element));
  if (productModalAddCartBtn) hideElement(productModalAddCartBtn);
  hideElement(homeContactSection);
}

if (cart.length) {
  updateCartCount();
}

// Normalize text for search (remove accents, lowercase)
function normalizeText(text){ return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

function getSearchableProductText(product) {
  return normalizeText([
    product?.name,
    product?.category,
    product?.description,
    product?.short_description
  ].filter(Boolean).join(' '));
}

function filterCatalogSections(searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);
  const sectionsAll = document.querySelectorAll('.section');
  const tabButtonsAll = document.querySelectorAll('.tabs button');

  if (!sectionsAll.length || !tabButtonsAll.length) return false;

  if (normalizedSearch === '') {
    sectionsAll.forEach((section, index) => {
      section.classList.remove('active');
      if (tabButtonsAll[index]) tabButtonsAll[index].classList.remove('active');
    });
    sectionsAll[0].classList.add('active');
    tabButtonsAll[0].classList.add('active');
    document.querySelectorAll('.card').forEach((card) => {
      card.style.display = 'block';
    });
    return true;
  }

  let firstSection = null;
  sectionsAll.forEach((section) => {
    const cards = section.querySelectorAll('.card');
    let hasVisibleCards = false;

    cards.forEach((card) => {
      const cardText = normalizeText(card.textContent);
      if (cardText.includes(normalizedSearch)) {
        card.style.display = 'block';
        hasVisibleCards = true;
      } else {
        card.style.display = 'none';
      }
    });

    if (hasVisibleCards && !firstSection) firstSection = section;
  });

  sectionsAll.forEach((section, index) => {
    section.classList.remove('active');
    if (tabButtonsAll[index]) tabButtonsAll[index].classList.remove('active');
  });

  if (firstSection) {
    firstSection.classList.add('active');
    const sectionIndex = [...sectionsAll].indexOf(firstSection);
    if (tabButtonsAll[sectionIndex]) tabButtonsAll[sectionIndex].classList.add('active');
  }

  return true;
}

function filterHomeFeaturedProducts(searchTerm) {
  const resultsSection = document.getElementById('homeSearchResults');
  const resultsGrid = document.getElementById('homeSearchResultsGrid');
  const showcase = document.getElementById('featuredShowcase');
  const grid = document.getElementById('featuredProductsGrid');
  if (!showcase || !grid || !resultsSection || !resultsGrid) return false;

  const title = resultsSection.querySelector('.landing-title');
  const copy = resultsSection.querySelector('.landing-copy');
  const cta = resultsSection.querySelector('.featured-showcase-cta');

  if (title && !title.dataset.defaultText) title.dataset.defaultText = title.textContent;
  if (copy && !copy.dataset.defaultText) copy.dataset.defaultText = copy.textContent;
  if (cta && !cta.dataset.defaultText) cta.dataset.defaultText = cta.textContent;

  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch) {
    document.body.classList.remove('home-search-active');
    resultsSection.hidden = true;
    resultsGrid.replaceChildren();
    if (title?.dataset.defaultText) title.textContent = title.dataset.defaultText;
    if (copy?.dataset.defaultText) copy.textContent = copy.dataset.defaultText;
    if (cta?.dataset.defaultText) {
      cta.textContent = cta.dataset.defaultText;
      cta.hidden = false;
    }
    renderHomeFeaturedProducts();
    return true;
  }

  const matchingProducts = products
    .filter((product) => shouldDisplayProduct(product) && getSearchableProductText(product).includes(normalizedSearch))
    .sort(sortProductsForDisplay);

  const wasSearchActive = document.body.classList.contains('home-search-active');
  document.body.classList.add('home-search-active');
  resultsSection.hidden = false;
  resultsGrid.replaceChildren();

  if (title) title.textContent = `Resultados para "${searchTerm.trim()}"`;
  if (copy) {
    copy.textContent = matchingProducts.length
      ? `Mostrando ${matchingProducts.length} producto(s) para "${searchTerm.trim()}".`
      : `No encontramos productos para "${searchTerm.trim()}".`;
  }
  if (cta) {
    cta.textContent = 'Ver catalogo completo';
    cta.hidden = matchingProducts.length === 0;
  }

  if (!matchingProducts.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'orders-empty';
    emptyState.textContent = 'Prueba con otro nombre o abre el catalogo completo.';
    resultsGrid.appendChild(emptyState);
    if (!wasSearchActive) {
      requestAnimationFrame(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return true;
  }

  matchingProducts.forEach((product) => {
    resultsGrid.appendChild(buildProductCard(product));
  });

  if (!wasSearchActive) {
    requestAnimationFrame(() => {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return true;
}

function handleStorefrontSearch(searchTerm) {
  if (filterCatalogSections(searchTerm)) return;
  filterHomeFeaturedProducts(searchTerm);
}

function getWelcomeModalElements() {
  return {
    modal: document.getElementById('welcomeModal'),
    form: document.getElementById('welcomeForm'),
    firstName: document.getElementById('welcomeFirstName'),
    lastName: document.getElementById('welcomeLastName'),
    email: document.getElementById('welcomeEmail'),
    phone: document.getElementById('welcomePhone'),
    marketing: document.getElementById('welcomeMarketing'),
    status: document.getElementById('welcomeStatus'),
    closeButton: document.getElementById('closeWelcomeModal'),
    skipButton: document.getElementById('welcomeSkipBtn')
  };
}

function setWelcomeStatus(message = '', type = '') {
  const { status } = getWelcomeModalElements();
  if (!status) return;

  status.textContent = message;
  status.className = 'welcome-status';
  if (type) status.classList.add(type);
}

function fillWelcomeForm(profile) {
  const elements = getWelcomeModalElements();
  const storedProfile = profile || (typeof window.getBeautyfastStoredProfile === 'function' ? window.getBeautyfastStoredProfile() : null);
  if (!storedProfile) return;

  if (elements.firstName) elements.firstName.value = storedProfile.firstName || '';
  if (elements.lastName) elements.lastName.value = storedProfile.lastName || '';
  if (elements.email) elements.email.value = storedProfile.email || '';
  if (elements.phone) elements.phone.value = storedProfile.phone || '';
  if (elements.marketing) elements.marketing.checked = Boolean(storedProfile.marketingConsent);
}

function markWelcomeModalSeen() {
  try {
    sessionStorage.setItem(WELCOME_MODAL_DISMISSED_SESSION_KEY, '1');
  } catch (error) {
    return;
  }
}

function clearLegacyWelcomeModalSeenFlag() {
  try {
    localStorage.removeItem(WELCOME_MODAL_SEEN_KEY);
  } catch (error) {
    return;
  }
}

function wasWelcomeModalDismissedThisSession() {
  try {
    return sessionStorage.getItem(WELCOME_MODAL_DISMISSED_SESSION_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function closeWelcomeModal(markSeen = true) {
  const { modal } = getWelcomeModalElements();
  if (!modal) return;

  if (markSeen) markWelcomeModalSeen();

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('welcome-modal-open');
}

function openWelcomeModal() {
  const { modal, firstName } = getWelcomeModalElements();
  if (!modal) return;

  fillWelcomeForm();
  setWelcomeStatus('');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('welcome-modal-open');

  window.setTimeout(() => {
    firstName?.focus();
  }, 30);
}

function initializeWelcomeModal() {
  const elements = getWelcomeModalElements();
  if (!elements.modal || !elements.form || elements.modal.dataset.initialized === 'true') return;
  elements.modal.dataset.initialized = 'true';

  clearLegacyWelcomeModalSeenFlag();

  fillWelcomeForm();

  elements.closeButton?.addEventListener('click', () => closeWelcomeModal(true));
  elements.skipButton?.addEventListener('click', () => closeWelcomeModal(true));
  elements.modal.querySelectorAll('[data-welcome-close]').forEach((element) => {
    element.addEventListener('click', () => closeWelcomeModal(true));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.modal.hidden) {
      closeWelcomeModal(true);
    }
  });

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();

    const payload = {
      firstName: elements.firstName?.value.trim() || '',
      lastName: elements.lastName?.value.trim() || '',
      email: elements.email?.value.trim() || '',
      phone: elements.phone?.value.trim() || '',
      marketingConsent: Boolean(elements.marketing?.checked)
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone) {
      setWelcomeStatus('Completa todos los campos antes de continuar.', 'is-error');
      return;
    }

    if (typeof window.saveBeautyfastStoredProfile === 'function') {
      window.saveBeautyfastStoredProfile(payload);
    }

    if (typeof window.prefillBeautyfastContactFields === 'function') {
      window.prefillBeautyfastContactFields(document);
    }

    markWelcomeModalSeen();
    renderHeaderAccount();
    setWelcomeStatus('Tus datos se guardaron para autocompletar futuras compras.', 'is-success');

    window.setTimeout(() => {
      closeWelcomeModal(false);
    }, 500);
  });
}

function maybeShowWelcomeModal() {
  const { modal } = getWelcomeModalElements();
  if (!modal) return;
  if (storefrontSessionState.user || storefrontSessionState.isAdmin) return;
  if (typeof window.getBeautyfastStoredProfile === 'function' && window.getBeautyfastStoredProfile()) return;
  if (wasWelcomeModalDismissedThisSession()) return;

  window.setTimeout(() => {
    openWelcomeModal();
  }, 320);
}

// ---------------- Funciones básicas ----------------
// Prevenir manipulación de precios: solo se usa el precio interno
window.addToCart = function(name){
  if (isAdminStorefrontSession()) {
    void fireStorefrontAlert({
      icon: 'info',
      title: 'Cuenta de administrador',
      text: 'La cuenta de administrador no puede agregar productos al carrito.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  const product = products.find(p => p.name === name);
  if (!product) {
    void fireStorefrontAlert({ icon: 'error', title: 'Producto no encontrado', toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
    return;
  }
  if (product.out_of_stock) {
    void fireStorefrontAlert({ icon: 'info', title: 'Producto agotado', text: 'Este producto está marcado como fuera de stock y no se puede agregar al carrito.' });
    return;
  }
  const existing = cart.find(i=>i.name===name);
  const productPrice = getProductCurrentPrice(product);
  if(existing) existing.quantity = clampCartQuantity(existing.quantity + 1);
  else cart.push({name, price: productPrice, quantity:1, image: product.image || ""});
  saveCart(); updateCartCount(); renderCart();
  void fireStorefrontAlert({ 
    icon:'success', 
    title:`"${name}" agregado`, 
    toast:true, 
    position:'top-end', 
    showConfirmButton:false, 
    timer:800 
  });
}

function updateCartCount(){
  const totalItems = cart.reduce((sum,i)=>sum+i.quantity,0);
  const cartCountEl = document.getElementById("cartCount");
  if (cartCountEl) cartCountEl.innerText = totalItems;
  updateWhatsappLink();
}

function saveCart(){
  if (typeof window.saveBeautyfastStoredCart === 'function') {
    window.saveBeautyfastStoredCart(cart);
    return;
  }

  localStorage.setItem("cart",JSON.stringify(cart));
}
function removeFromCart(index){ cart.splice(index,1); saveCart(); updateCartCount(); renderCart(); }

// ---------------- Formato moneda ----------------
function formatRD(amount){
  return "RD$ "+amount.toLocaleString("es-DO",{minimumFractionDigits:2, maximumFractionDigits:2});
}

// update the floating Whatsapp link so the message includes current cart total
function updateWhatsappLink(cliente = null, pedido = null){
  const whatsappBtn = document.querySelector('.whatsapp-button');
  if(!whatsappBtn) return;
  let text = 'Hola, quiero más información...';
  if(cliente && pedido) {
    text = `Hola, confirmo mi pedido.\nCliente: ${cliente.nombre}\nTel: ${cliente.telefono}\nDirección: ${cliente.direccion}\nPedido: #${pedido}`;
  }
  whatsappBtn.href = `https://wa.me/18493990014?text=${encodeURIComponent(text)}`;
}

// ---------------- Renderizar carrito ----------------

function getCartItemImage(item) {
  if (item.image) return item.image;
  const product = products.find(p => p.name === item.name);
  if (product && product.image) return product.image;
  const card = [...document.querySelectorAll(".card")].find((cardEl) => {
    const titleEl = cardEl.querySelector(".card-title, h3");
    return titleEl && titleEl.textContent.trim() === item.name;
  });
  return card?.querySelector("img")?.getAttribute("src") || "";
}

function renderCart(){
  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const actions = document.querySelector('.cart-actions');
  if (!container || !totalEl) return;

  if (isAdminStorefrontSession()) {
    container.replaceChildren();
    const message = document.createElement('div');
    message.className = 'cart-empty';
    message.textContent = 'La cuenta de administrador no usa carrito.';
    container.appendChild(message);
    totalEl.innerText = 'Total: RD$ 0.00';
    if (actions) actions.style.display = 'none';
    return;
  }

  container.replaceChildren();
  let total = 0;

  if (cart.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "cart-empty";
    emptyState.textContent = "Carrito vacio";
    container.appendChild(emptyState);
    totalEl.innerText = "Total: RD$ 0.00";
    if (actions) actions.style.display = 'none';
    return;
  }

  if (actions) actions.style.display = '';

  cart.forEach((item,index)=>{
    const div = document.createElement("div");
    div.classList.add("cart-item");
    const itemImage = getCartItemImage(item);

    const itemMain = document.createElement("div");
    itemMain.className = "cart-item-main";

    if (itemImage) {
      const image = document.createElement("img");
      image.src = itemImage;
      image.alt = item.name;
      image.className = "cart-item-image";
      itemMain.appendChild(image);
    }

    const itemCopy = document.createElement("div");
    itemCopy.className = "cart-item-copy";

    const itemName = document.createElement("span");
    itemName.className = "cart-item-name";
    itemName.textContent = item.name;

    const itemLineTotal = document.createElement("span");
    itemLineTotal.className = "cart-item-line-total";
    itemLineTotal.textContent = formatRD(item.price * item.quantity);

    itemCopy.appendChild(itemName);
    itemCopy.appendChild(itemLineTotal);
    itemMain.appendChild(itemCopy);

    const qtyControl = document.createElement("div");
    qtyControl.className = "qty-control";

    const btnTrash = document.createElement("button");
    btnTrash.className = "qty-btn trash";

    const btnMinus = document.createElement("button");
    btnMinus.className = "qty-btn minus";
    btnMinus.textContent = "-";

    const qtyInput = document.createElement("input");
    qtyInput.type = "text";
    qtyInput.value = String(item.quantity);
    qtyInput.readOnly = true;

    const btnPlus = document.createElement("button");
    btnPlus.className = "qty-btn plus";
    btnPlus.textContent = "+";

    qtyControl.appendChild(btnTrash);
    qtyControl.appendChild(btnMinus);
    qtyControl.appendChild(qtyInput);
    qtyControl.appendChild(btnPlus);

    div.appendChild(itemMain);
    div.appendChild(qtyControl);
    container.appendChild(div);
    total += item.price * item.quantity;

    if (item.quantity === 1) {
      btnMinus.style.display = "none";
      btnTrash.style.display = "flex";
    } else {
      btnMinus.style.display = "flex";
      btnTrash.style.display = "none";
    }

    btnPlus.addEventListener("click", (e) => {
      e.stopPropagation();
      item.quantity = clampCartQuantity(item.quantity + 1);
      saveCart();
      updateCartCount();
      renderCart();
    });

    btnMinus.addEventListener("click", (e) => {
      e.stopPropagation();
      item.quantity = clampCartQuantity(item.quantity - 1);
      saveCart();
      updateCartCount();
      renderCart();
    });

    btnTrash.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromCart(index);
    });
  });

  totalEl.innerText = "Total: " + formatRD(total);
}

// ---------------- Abrir / Cerrar panel y overlay ----------------
const cartIcon = document.querySelector(".cart");
const cartPanel = document.getElementById("cartPanel");      // PANEL del carrito
const closeCartBtn = document.getElementById('closeCart');   // Botón X para cerrar
const cartOverlay = document.getElementById('cartOverlay');  // OVERLAY del carrito
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let activeDialog = null;
let lastFocusedElement = null;

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(focusableSelector)]
    .filter((element) => !element.hasAttribute('hidden') && element.offsetParent !== null);
}

function trapDialogFocus(event) {
  if (event.key !== 'Tab' || !activeDialog) return;

  const focusableElements = getFocusableElements(activeDialog);
  if (!focusableElements.length) {
    event.preventDefault();
    activeDialog.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function openDialog(dialog, trigger, options = {}) {
  if (!dialog) return;

  lastFocusedElement = trigger || document.activeElement;
  activeDialog = dialog;
  dialog.setAttribute('tabindex', '-1');
  dialog.setAttribute('aria-hidden', 'false');
  if (options.onOpen) options.onOpen();

  const focusableElements = getFocusableElements(dialog);
  const preferredFocus = options.initialFocus || focusableElements[0] || dialog;
  preferredFocus.focus();
}

function closeDialog(dialog, options = {}) {
  if (!dialog) return;

  dialog.setAttribute('aria-hidden', 'true');
  if (options.onClose) options.onClose();

  if (activeDialog === dialog) {
    activeDialog = null;
  }

  const returnFocusTarget = options.returnFocusTo || lastFocusedElement;
  if (returnFocusTarget && typeof returnFocusTarget.focus === 'function') {
    returnFocusTarget.focus();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (productModal?.classList.contains('show')) {
      closeProductModal();
      return;
    }

    if (cartPanel?.classList.contains('show')) {
      closeCartPanel();
    }
  }

  trapDialogFocus(event);
});

function openCartPanel(trigger) {
  if (!cartPanel || !cartOverlay) return;

  cartPanel.classList.add("show");
  cartOverlay.classList.add("show");
  if (cartIcon) cartIcon.setAttribute('aria-expanded', 'true');
  openDialog(cartPanel, trigger || cartIcon, { initialFocus: closeCartBtn });
}

function closeCartPanel() {
  if (!cartPanel || !cartOverlay) return;

  closeDialog(cartPanel, {
    returnFocusTo: cartIcon,
    onClose: () => {
      cartPanel.classList.remove("show");
      cartOverlay.classList.remove("show");
      if (cartIcon) cartIcon.setAttribute('aria-expanded', 'false');
    }
  });
}

if (cartPanel) cartPanel.setAttribute('aria-hidden', 'true');
if (cartIcon) cartIcon.setAttribute('aria-expanded', 'false');

// Abrir panel
if (cartIcon && cartPanel && closeCartBtn && cartOverlay) {
  cartIcon.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cartIcon.click();
    }
  });

  cartIcon.addEventListener("click", e => {
    openCartPanel(cartIcon);
    e.stopPropagation();

    // Mostrar toast si carrito vacío
    if(cart.length === 0){
      void fireStorefrontAlert({
        icon: 'info',
        title: 'Carrito vacío 🛒',
        text: 'Agrega productos para empezar a comprar.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
      });
    }
  });

  // Cerrar panel con X
  closeCartBtn.addEventListener('click', closeCartPanel);

  // Cerrar panel al hacer clic en overlay
  cartOverlay.addEventListener('click', closeCartPanel);

  // Evita que clics dentro del panel cierren accidentalmente
  cartPanel.addEventListener('click', e => e.stopPropagation());
}

// ---------------- Vaciar carrito ----------------
const emptyCartBtn = document.getElementById("emptyCart");
if (emptyCartBtn) {
  emptyCartBtn.addEventListener("click", () => {
    if(cart.length === 0){
      void fireStorefrontAlert({
        icon: 'info',
        title: '¡Nada que borrar! 😅',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true
      });
      return;
    }
    cart = [];
    saveCart();
    updateCartCount();
    renderCart();

    void fireStorefrontAlert({
      icon: 'info',
      title: 'Carrito vaciado 🛒',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1000,
      timerProgressBar: true
    });
  });
}

// ---------------- Pagar ----------------
const cartCheckoutBtn = document.querySelector(".cart-actions #checkoutBtn");
if (cartCheckoutBtn) {
  cartCheckoutBtn.addEventListener("click", () => {
    if(cart.length === 0){
      void fireStorefrontAlert({
        icon: 'warning',
        title: '¡Oops! 😅',
        text: 'Tu carrito está vacío. Agrega productos antes de continuar.',
        confirmButtonText: 'Ok'
      });
      return;
    }
    // Redirigir a la página de checkout
    window.location.href = "checkout.html";
  });
}

// Moneda RD$
function formatRD(value){ return value.toLocaleString("es-DO",{style:"currency",currency:"DOP"}); }

// Tabs (debe ser global)
window.showSection = function(sectionId,btn){
  const sections=document.querySelectorAll(".section");
  sections.forEach(sec=>sec.classList.remove("active"));
  const section=document.getElementById(sectionId);
  if (!section) return;
  section.classList.add("active");
  const tabButtons=document.querySelectorAll(".tabs button");
  tabButtons.forEach(b=>b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

// Handle clear button click
if (clearSearchBtn && searchInput) {
  clearSearchBtn.addEventListener("click",()=>{ 
    searchInput.value="";
    searchInput.classList.remove("active");
    clearSearchBtn.classList.remove("show");
    if (searchBox) searchBox.classList.remove('search-open');
    searchInput.dispatchEvent(new Event("input")); 
  });
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================

// Product database fallback
const fallbackProducts = Object.freeze(
  typeof window.getBeautyfastFallbackProducts === 'function'
    ? window.getBeautyfastFallbackProducts()
    : (Array.isArray(window.BEAUTYFAST_FALLBACK_PRODUCTS) ? window.BEAUTYFAST_FALLBACK_PRODUCTS : [])
);

let products = [...fallbackProducts];
let storefrontShowsOutOfStock = false;

function slugifyProductName(value) {
  return normalizeText(String(value || ''))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProductCurrentPrice(product) {
  if (typeof window.getBeautyfastCatalogCurrentPrice === 'function') {
    return window.getBeautyfastCatalogCurrentPrice(product);
  }

  const basePrice = Number(product?.price || 0);
  const offerPrice = Number(product?.offer_price || 0);
  if (Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < basePrice) return offerPrice;
  return basePrice;
}

function formatPlainRD(value) {
  return `RD$ ${Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getOfferPercentage(product) {
  if (typeof window.getBeautyfastOfferPercentage === 'function') {
    return window.getBeautyfastOfferPercentage(product);
  }

  const basePrice = Number(product?.price || 0);
  const offerPrice = Number(product?.offer_price || 0);
  if (!Number.isFinite(basePrice) || !Number.isFinite(offerPrice) || basePrice <= 0 || offerPrice <= 0 || offerPrice >= basePrice) {
    return 0;
  }

  return Math.max(0, Math.round(((basePrice - offerPrice) / basePrice) * 100));
}

function sortProductsForDisplay(left, right) {
  const leftFeatured = left?.featured ? 1 : 0;
  const rightFeatured = right?.featured ? 1 : 0;
  if (leftFeatured !== rightFeatured) return rightFeatured - leftFeatured;

  const leftSort = Number(left?.sort_order);
  const rightSort = Number(right?.sort_order);
  if (Number.isFinite(leftSort) && Number.isFinite(rightSort) && leftSort !== rightSort) {
    return leftSort - rightSort;
  }

  return String(left?.name || '').localeCompare(String(right?.name || ''));
}

function getDefaultHomeSlides() {
  return typeof window.getBeautyfastDefaultHomeSlides === 'function'
    ? window.getBeautyfastDefaultHomeSlides()
    : [];
}

function normalizeHomeSlide(slide, index) {
  if (typeof window.normalizeBeautyfastHomeSlide === 'function') {
    return window.normalizeBeautyfastHomeSlide(slide, index);
  }

  return {
    id: String(slide?.id || `hero-slide-${index + 1}`).trim(),
    image_url: String(slide?.image_url || '').trim(),
    alt_text: String(slide?.alt_text || `Slide ${index + 1}`).trim(),
    link_url: String(slide?.link_url || 'beautyfast.html').trim(),
    active: slide?.active !== false,
    sort_order: Number.isFinite(Number(slide?.sort_order)) ? Number(slide.sort_order) : index + 1
  };
}

function normalizeHomeSlidesCollection(slides) {
  return (Array.isArray(slides) ? slides : [])
    .map((slide, index) => normalizeHomeSlide(slide, index))
    .filter((slide) => slide.image_url && slide.active !== false)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
}

function normalizeProductRecord(product, index) {
  const basePrice = Number(product.price || 0);
  const offerPrice = Number(product.offer_price || 0);
  const category = ['capilar', 'individuales', 'otros'].includes(product.category) ? product.category : 'otros';

  return {
    id: product.id || index + 1,
    name: String(product.name || '').trim(),
    slug: String(product.slug || slugifyProductName(product.name || `producto-${index + 1}`)),
    price: Number.isFinite(basePrice) ? basePrice : 0,
    offer_price: Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : null,
    image: String(product.image_url || product.image || 'img/linea.jpg').trim() || 'img/linea.jpg',
    description: String(product.description || 'Producto disponible en El Secreto de Aris.').trim(),
    category,
    active: product.active !== false,
    out_of_stock: Boolean(product.out_of_stock),
    featured: Boolean(product.featured),
    sort_order: Number.isFinite(Number(product.sort_order)) ? Number(product.sort_order) : index + 1
  };
}

function normalizeStockVisibilitySetting(value) {
  return Boolean(value && typeof value === 'object' && value.show_out_of_stock === true);
}

function shouldDisplayProduct(product) {
  if (!product || product.active === false) return false;
  if (!storefrontShowsOutOfStock && product.out_of_stock) return false;
  return true;
}

function mergeCatalogProductsForDisplay(remoteProducts, catalogMode) {
  if (catalogMode === 'supabase') {
    return [...remoteProducts].sort(sortProductsForDisplay);
  }

  const mergedProducts = new Map(fallbackProducts.map((product) => [String(product?.slug || product?.name || ''), product]));
  remoteProducts.forEach((product) => {
    mergedProducts.set(String(product?.slug || product?.name || ''), product);
  });

  return [...mergedProducts.values()].sort(sortProductsForDisplay);
}

function getCachedCatalogProducts() {
  if (typeof window.getBeautyfastCachedCatalog !== 'function') return [];

  const cachedCatalog = window.getBeautyfastCachedCatalog({ products: [], catalogMode: '' });
  const cachedRemoteProducts = Array.isArray(cachedCatalog?.products)
    ? cachedCatalog.products.map(normalizeProductRecord).filter((product) => product?.name)
    : [];

  if (!cachedRemoteProducts.length) return [];
  return mergeCatalogProductsForDisplay(cachedRemoteProducts, String(cachedCatalog?.catalogMode || '').trim().toLowerCase());
}

function isPublicSettingCacheFresh(settingKey) {
  return Boolean(window.isBeautyfastPublicSettingCacheFresh?.(settingKey, PUBLIC_SETTING_CACHE_MAX_AGE_MS));
}

function isCatalogCacheFresh() {
  return Boolean(window.isBeautyfastCatalogCacheFresh?.(CATALOG_CACHE_MAX_AGE_MS));
}

function refreshStorefrontCatalogView() {
  renderProductCatalog();
  renderHomeFeaturedProducts();
  syncCartProductData();
  initializeProductCards();

  if (typeof window.refreshBeautyfastSidebarMenu === 'function') {
    window.refreshBeautyfastSidebarMenu();
  }

  if (searchInput?.value) {
    searchInput.dispatchEvent(new Event('input'));
  }
}

async function refreshProductsCatalogInBackground() {
  if (typeof window.resolveBeautyfastCatalog !== 'function') return;

  let result;
  try {
    result = await window.resolveBeautyfastCatalog({ normalizeProduct: normalizeProductRecord, mergeKey: 'slug' });
  } catch (error) {
    return;
  }

  const nextProducts = result.products || [];

  if (JSON.stringify(nextProducts) === JSON.stringify(products)) return;

  products = nextProducts;
  refreshStorefrontCatalogView();
}

async function refreshStockVisibilitySettingInBackground() {
  if (typeof window.fetchBeautyfastPublicSetting !== 'function') return;

  try {
    const result = await window.fetchBeautyfastPublicSetting(STOCK_VISIBILITY_SETTING_KEY);
    if (!result.ok) return;

    const nextValue = normalizeStockVisibilitySetting(result.data);

    if (typeof window.setBeautyfastCachedPublicSetting === 'function') {
      window.setBeautyfastCachedPublicSetting(STOCK_VISIBILITY_SETTING_KEY, {
        show_out_of_stock: nextValue
      });
    }

    if (storefrontShowsOutOfStock === nextValue) return;

    storefrontShowsOutOfStock = nextValue;
    refreshStorefrontCatalogView();
  } catch (error) {
    console.warn('No se pudo actualizar la visibilidad de inventario.', error);
  }
}

async function loadProductsCatalog() {
  const cachedStockVisibility = typeof window.getBeautyfastCachedPublicSetting === 'function'
    ? window.getBeautyfastCachedPublicSetting(STOCK_VISIBILITY_SETTING_KEY, { show_out_of_stock: false })
    : { show_out_of_stock: false };
  storefrontShowsOutOfStock = normalizeStockVisibilitySetting(cachedStockVisibility);

  const cachedProducts = getCachedCatalogProducts();
  const hasFreshCatalogCache = isCatalogCacheFresh();
  const hasFreshStockVisibilityCache = isPublicSettingCacheFresh(STOCK_VISIBILITY_SETTING_KEY);

  if (!hasFreshStockVisibilityCache) {
    runWhenStorefrontIdle(() => refreshStockVisibilitySettingInBackground());
  }

  if (cachedProducts.length) {
    products = cachedProducts;
    return {
      source: 'cache',
      refreshPromise: hasFreshCatalogCache
        ? null
        : runWhenStorefrontIdle(() => refreshProductsCatalogInBackground())
    };
  }

  if (typeof window.resolveBeautyfastCatalog === 'function') {
    const result = await window.resolveBeautyfastCatalog({ normalizeProduct: normalizeProductRecord, mergeKey: 'slug' });

    products = result.products || [];
    return { source: result.source, empty: result.empty, error: result.error };
  }

  products = fallbackProducts.map(normalizeProductRecord).filter((product) => product.name);
  return { source: 'fallback' };
}

function syncCartProductData() {
  if (typeof window.syncBeautyfastCartWithCatalog === 'function') {
    const result = window.syncBeautyfastCartWithCatalog(cart, products);
    cart = result.items;
  }

  saveCart();
  updateCartCount();
  renderCart();
}

function buildProductCard(product) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.productId = String(product.id);

  const cardImage = document.createElement('div');
  cardImage.className = 'card-image';

  const image = document.createElement('img');
  image.src = product.image;
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.fetchPriority = 'low';

  cardImage.appendChild(image);

  const offerPercentage = getOfferPercentage(product);
  if (offerPercentage > 0) {
    const badge = document.createElement('span');
    badge.className = 'card-offer-badge';
    badge.textContent = `${offerPercentage}% OFF`;
    cardImage.appendChild(badge);
  }

  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';

  if (product.featured) {
    const featuredChip = document.createElement('span');
    featuredChip.className = 'card-featured-chip';
    featuredChip.textContent = 'Destacado';
    cardBody.appendChild(featuredChip);
  }

  if (product.out_of_stock) {
    const stockChip = document.createElement('span');
    stockChip.className = 'card-featured-chip card-stock-chip';
    stockChip.textContent = 'Agotado';
    cardBody.appendChild(stockChip);
  }

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = product.name;

  const price = document.createElement('p');
  price.className = 'card-price';
  const currentPrice = getProductCurrentPrice(product);
  if (product.offer_price && currentPrice < Number(product.price || 0)) {
    price.innerHTML = `<span class="card-price-original">${formatPlainRD(product.price)}</span> ${formatPlainRD(currentPrice)}`;
  } else {
    price.textContent = formatPlainRD(currentPrice);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = isAdminStorefrontSession()
    ? 'Ver detalle'
    : (product.out_of_stock ? 'Agotado' : 'Agregar al carrito');
  button.disabled = !isAdminStorefrontSession() && product.out_of_stock;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (button.disabled) return;
    if (isAdminStorefrontSession()) {
      openProductModal(product.id);
      return;
    }
    addToCart(product.name);
  });

  card.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    openProductModal(product.id);
  });

  cardBody.appendChild(title);
  cardBody.appendChild(price);
  cardBody.appendChild(button);
  card.appendChild(cardImage);
  card.appendChild(cardBody);

  return card;
}

function renderProductCatalog() {
  const sections = {
    capilar: document.getElementById('capilar'),
    individuales: document.getElementById('individuales'),
    otros: document.getElementById('otros')
  };

  if (!sections.capilar && !sections.individuales && !sections.otros) return;

  Object.entries(sections).forEach(([category, section]) => {
    if (!section) return;

    section.replaceChildren();
    const categoryProducts = products
      .filter((product) => product.category === category && shouldDisplayProduct(product))
      .sort(sortProductsForDisplay);

    if (!categoryProducts.length) {
      const emptyState = document.createElement('div');
      emptyState.className = 'orders-empty';
      emptyState.textContent = 'No hay productos disponibles en esta categoría por ahora.';
      section.appendChild(emptyState);
      return;
    }

    categoryProducts.forEach((product) => {
      section.appendChild(buildProductCard(product));
    });
  });
}

function getFeaturedProducts(limit = 4) {
  return products
    .filter((product) => shouldDisplayProduct(product) && product.featured)
    .sort(sortProductsForDisplay)
    .slice(0, limit);
}

function renderHomeFeaturedProducts() {
  const showcase = document.getElementById('featuredShowcase');
  const grid = document.getElementById('featuredProductsGrid');
  if (!showcase || !grid) return;

  const featuredProducts = getFeaturedProducts();
  if (!featuredProducts.length) {
    showcase.hidden = true;
    grid.replaceChildren();
    return;
  }

  showcase.hidden = false;
  grid.replaceChildren();
  featuredProducts.forEach((product) => {
    grid.appendChild(buildProductCard(product));
  });
}

function getDefaultHomeTestimonials() {
  return typeof window.getBeautyfastDefaultHomeTestimonials === 'function'
    ? window.getBeautyfastDefaultHomeTestimonials()
    : [];
}

function normalizeHomeTestimonialRecord(testimonial, index) {
  if (typeof window.normalizeBeautyfastHomeTestimonial === 'function') {
    return window.normalizeBeautyfastHomeTestimonial(testimonial, index);
  }

  return {
    id: String(testimonial?.id || `testimonial-${index + 1}`).trim(),
    image_url: String(testimonial?.image_url || '').trim(),
    customer_name: String(testimonial?.customer_name || `Cliente ${index + 1}`).trim(),
    quote: String(testimonial?.quote || '').trim(),
    active: testimonial?.active !== false,
    sort_order: Number.isFinite(Number(testimonial?.sort_order)) ? Number(testimonial.sort_order) : index + 1
  };
}

function normalizeHomeTestimonialsCollection(testimonials) {
  return [...(Array.isArray(testimonials) ? testimonials : [])]
    .map((testimonial, index) => normalizeHomeTestimonialRecord(testimonial, index))
    .filter((testimonial) => testimonial.active !== false && testimonial.image_url)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
}

function getDefaultHomeFaqs() {
  return typeof window.getBeautyfastDefaultHomeFaqs === 'function'
    ? window.getBeautyfastDefaultHomeFaqs()
    : [];
}

function normalizeHomeFaqRecord(faq, index) {
  if (typeof window.normalizeBeautyfastHomeFaq === 'function') {
    return window.normalizeBeautyfastHomeFaq(faq, index);
  }

  return {
    id: String(faq?.id || `faq-${index + 1}`).trim(),
    question: String(faq?.question || '').trim(),
    answer: String(faq?.answer || '').trim(),
    active: faq?.active !== false,
    sort_order: Number.isFinite(Number(faq?.sort_order)) ? Number(faq.sort_order) : index + 1
  };
}

function normalizeHomeFaqCollection(faqs) {
  return [...(Array.isArray(faqs) ? faqs : [])]
    .map((faq, index) => normalizeHomeFaqRecord(faq, index))
    .filter((faq) => faq.active !== false && faq.question && faq.answer)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
}

function renderHomeTestimonials(testimonials) {
  const showcase = document.getElementById('testimonialsShowcase');
  const slidesRoot = document.getElementById('homeTestimonialsSlides');
  if (!showcase || !slidesRoot) return;

  if (!testimonials.length) {
    showcase.hidden = true;
    slidesRoot.innerHTML = '';
    return;
  }

  showcase.hidden = false;
  slidesRoot.innerHTML = testimonials.map((testimonial, index) => `
    <div class="swiper-slide" data-testimonial-id="${escapeHtml(testimonial.id || `testimonial-${index + 1}`)}">
      <article class="testimonial-slide-card">
        <div class="testimonial-slide-media">
          <img src="${escapeHtml(testimonial.image_url)}" alt="Testimonio de ${escapeHtml(testimonial.customer_name)}" class="testimonial-slide-image" loading="lazy" decoding="async" fetchpriority="low">
        </div>
        <div class="testimonial-slide-body">
          <p class="testimonial-slide-quote">${escapeHtml(testimonial.quote || 'Testimonio destacado de Beautyfast.')}</p>
          <span class="testimonial-slide-name">${escapeHtml(testimonial.customer_name)}</span>
        </div>
      </article>
    </div>
  `).join('');
}

let homeTestimonialsSwiper = null;

function mountHomeTestimonialsSwiper() {
  const swiperElement = document.querySelector('.testimonials-swiper');
  if (!swiperElement || typeof window.Swiper !== 'function') return;

  if (homeTestimonialsSwiper) {
    homeTestimonialsSwiper.destroy(true, true);
    homeTestimonialsSwiper = null;
  }

  homeTestimonialsSwiper = new window.Swiper('.testimonials-swiper', {
    loop: true,
    autoplay: {
      delay: 3600,
      disableOnInteraction: false
    },
    pagination: {
      el: '.testimonials-pagination',
      clickable: true
    },
    navigation: {
      nextEl: '.testimonials-button-next',
      prevEl: '.testimonials-button-prev'
    },
    slidesPerView: 1,
    spaceBetween: 18,
    speed: 700,
    breakpoints: {
      820: {
        slidesPerView: 1.2
      },
      1080: {
        slidesPerView: 1.6
      }
    }
  });
}

async function initializeHomeTestimonials() {
  const slidesRoot = document.getElementById('homeTestimonialsSlides');
  if (!slidesRoot) return;

  const defaultTestimonials = normalizeHomeTestimonialsCollection(getDefaultHomeTestimonials());
  const cachedSetting = typeof window.getBeautyfastCachedPublicSetting === 'function'
    ? window.getBeautyfastCachedPublicSetting(HOME_TESTIMONIALS_SETTING_KEY, { testimonials: defaultTestimonials })
    : { testimonials: defaultTestimonials };
  let currentTestimonials = normalizeHomeTestimonialsCollection(cachedSetting?.testimonials);
  if (!currentTestimonials.length) currentTestimonials = defaultTestimonials;

  renderHomeTestimonials(currentTestimonials);
  scheduleTestimonialsSwiperMount();

  if (isPublicSettingCacheFresh(HOME_TESTIMONIALS_SETTING_KEY)) {
    return;
  }

  return runWhenStorefrontIdle(async () => {
    if (!window.fetchBeautyfastPublicSetting || !window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      return;
    }

    const result = await window.fetchBeautyfastPublicSetting(HOME_TESTIMONIALS_SETTING_KEY);
    if (!result.ok) return;

    const hasStoredTestimonials = Boolean(result.record);
    const remoteTestimonials = normalizeHomeTestimonialsCollection(result.data?.testimonials);
    const nextTestimonials = hasStoredTestimonials ? remoteTestimonials : defaultTestimonials;

    if (typeof window.setBeautyfastCachedPublicSetting === 'function') {
      window.setBeautyfastCachedPublicSetting(HOME_TESTIMONIALS_SETTING_KEY, { testimonials: nextTestimonials });
    }

    if (JSON.stringify(nextTestimonials) === JSON.stringify(currentTestimonials)) return;

    renderHomeTestimonials(nextTestimonials);
    scheduleTestimonialsSwiperMount();
  });
}

function renderHomeFaqs(faqs) {
  const list = document.getElementById('homeFaqList');
  if (!list) return;

  if (!faqs.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = faqs.map((faq) => `
    <details class="faq-item">
      <summary>${escapeHtml(faq.question)}</summary>
      <div>${escapeHtml(faq.answer)}</div>
    </details>
  `).join('');
}

async function initializeHomeFaqs() {
  const list = document.getElementById('homeFaqList');
  if (!list) return;

  const defaultFaqs = normalizeHomeFaqCollection(getDefaultHomeFaqs());
  const cachedSetting = typeof window.getBeautyfastCachedPublicSetting === 'function'
    ? window.getBeautyfastCachedPublicSetting(HOME_FAQ_SETTING_KEY, { faqs: defaultFaqs })
    : { faqs: defaultFaqs };
  let currentFaqs = normalizeHomeFaqCollection(cachedSetting?.faqs);
  if (!currentFaqs.length) currentFaqs = defaultFaqs;

  renderHomeFaqs(currentFaqs);

  if (isPublicSettingCacheFresh(HOME_FAQ_SETTING_KEY)) {
    return;
  }

  return runWhenStorefrontIdle(async () => {
    if (!window.fetchBeautyfastPublicSetting || !window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      return;
    }

    const result = await window.fetchBeautyfastPublicSetting(HOME_FAQ_SETTING_KEY);
    if (!result.ok) return;

    const hasStoredFaqs = Boolean(result.record);
    const remoteFaqs = normalizeHomeFaqCollection(result.data?.faqs);
    const nextFaqs = hasStoredFaqs ? remoteFaqs : defaultFaqs;

    if (typeof window.setBeautyfastCachedPublicSetting === 'function') {
      window.setBeautyfastCachedPublicSetting(HOME_FAQ_SETTING_KEY, { faqs: nextFaqs });
    }

    if (JSON.stringify(nextFaqs) === JSON.stringify(currentFaqs)) return;

    renderHomeFaqs(nextFaqs);
  });
}

function initializeDeferredHomeSections() {
  const testimonialsSection = document.getElementById('testimonialsShowcase')?.closest('section');
  const faqSection = document.getElementById('homeFaqList')?.closest('section');

  observeElementOnce(testimonialsSection, () => {
    void initializeHomeTestimonials();
  }, { rootMargin: '280px 0px', threshold: 0.01, timeout: 1500 });

  observeElementOnce(faqSection, () => {
    void initializeHomeFaqs();
  }, { rootMargin: '320px 0px', threshold: 0.01, timeout: 1800 });
}

function setHomeContactStatus(message = '', tone = '') {
  const status = document.getElementById('homeContactStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `contact-status${tone ? ` ${tone}` : ''}`;
}

function initializeHomeContactForm() {
  const form = document.getElementById('homeContactForm');
  const submitButton = document.getElementById('homeContactSubmitBtn');
  if (!form || !submitButton) return;

  if (typeof window.prefillBeautyfastContactFields === 'function') {
    window.prefillBeautyfastContactFields(document);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!window.saveBeautyfastContactMessage || !window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      setHomeContactStatus('Ahora mismo no podemos recibir mensajes desde aqui. Intentalo de nuevo en un momento.', 'is-error');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';
    setHomeContactStatus('Guardando tu mensaje...', '');

    const payload = {
      topic: form.querySelector('#contactTopic')?.value || 'Duda general',
      name: form.querySelector('#nombreContacto')?.value || '',
      email: form.querySelector('#emailContacto')?.value || '',
      message: form.querySelector('#mensajeContacto')?.value || ''
    };

    const result = await window.saveBeautyfastContactMessage(payload);
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar mensaje';

    if (!result.ok) {
      setHomeContactStatus(result.error || 'No pudimos enviar tu mensaje. Intentalo de nuevo.', 'is-error');
      return;
    }

    if (typeof window.saveBeautyfastStoredProfile === 'function') {
      const nameParts = String(payload.name || '').trim().split(/\s+/).filter(Boolean);
      window.saveBeautyfastStoredProfile({
        firstName: nameParts.shift() || payload.name,
        lastName: nameParts.join(' '),
        email: payload.email
      });
    }

    form.reset();
    setHomeContactStatus('Mensaje enviado. Te responderemos por correo lo antes posible.', 'is-success');
  });
}

function renderHomeHeroSlides(slides) {
  const slidesRoot = document.getElementById('homeHeroSlides');
  if (!slidesRoot) return;

  slidesRoot.innerHTML = slides.map((slide, index) => `
    <div class="swiper-slide" data-slide-id="${escapeHtml(slide.id || `hero-slide-${index + 1}`)}">
      <a href="${escapeHtml(slide.link_url || 'beautyfast.html')}" class="hero-slide-link">
        <img src="${escapeHtml(slide.image_url)}" alt="${escapeHtml(slide.alt_text || `Slide ${index + 1}`)}" class="hero-img-slide hero-img-contain ${index === 0 ? 'hero-img-hero' : ''}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${index === 0 ? 'high' : 'low'}">
      </a>
    </div>
  `).join('');
}

let homeHeroSwiper = null;

function mountHomeHeroSwiper() {
  const swiperElement = document.querySelector('.hero-swiper');
  if (!swiperElement || typeof window.Swiper !== 'function') return;

  if (homeHeroSwiper) {
    homeHeroSwiper.destroy(true, true);
    homeHeroSwiper = null;
  }

  homeHeroSwiper = new window.Swiper('.hero-swiper', {
    loop: true,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev'
    },
    effect: 'slide',
    speed: 700,
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 1,
    spaceBetween: 0,
    breakpoints: {
      900: {
        slidesPerView: 1,
        spaceBetween: 0
      }
    }
  });
}

async function initializeHomeHeroSlider() {
  const slidesRoot = document.getElementById('homeHeroSlides');
  if (!slidesRoot) return;

  const defaultSlides = normalizeHomeSlidesCollection(getDefaultHomeSlides());
  const cachedSetting = typeof window.getBeautyfastCachedPublicSetting === 'function'
    ? window.getBeautyfastCachedPublicSetting(HOME_SLIDER_SETTING_KEY, { slides: defaultSlides })
    : { slides: defaultSlides };
  let currentSlides = normalizeHomeSlidesCollection(cachedSetting?.slides);
  if (!currentSlides.length) currentSlides = defaultSlides;

  renderHomeHeroSlides(currentSlides);
  scheduleHeroSwiperMount();

  if (isPublicSettingCacheFresh(HOME_SLIDER_SETTING_KEY)) {
    return;
  }

  return runWhenStorefrontIdle(async () => {
    if (!window.fetchBeautyfastPublicSetting || !window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      return;
    }

    const result = await window.fetchBeautyfastPublicSetting(HOME_SLIDER_SETTING_KEY);
    if (!result.ok) return;

    const hasStoredSlides = Boolean(result.record);
    const remoteSlides = normalizeHomeSlidesCollection(result.data?.slides);
    const nextSlides = hasStoredSlides ? remoteSlides : defaultSlides;

    if (typeof window.setBeautyfastCachedPublicSetting === 'function') {
      window.setBeautyfastCachedPublicSetting(HOME_SLIDER_SETTING_KEY, { slides: nextSlides });
    }

    if (JSON.stringify(nextSlides) === JSON.stringify(currentSlides)) return;

    renderHomeHeroSlides(nextSlides);
    scheduleHeroSwiperMount();
  });
}

const productModal = document.getElementById('productModal');
const closeProductModalBtn = document.getElementById('closeProductModal');
const productModalAddCartBtn = document.getElementById('productModalAddCart');

if (productModal) productModal.setAttribute('aria-hidden', 'true');

let currentProductId = null;

// Open product modal
function openProductModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  currentProductId = productId;
  document.getElementById('productModalImage').src = product.image;
  document.getElementById('productModalTitle').textContent = product.name;
  document.getElementById('productModalDesc').textContent = product.description;
  document.getElementById('productModalPrice').textContent = formatRD(getProductCurrentPrice(product));
  if (productModalAddCartBtn) {
    productModalAddCartBtn.disabled = product.out_of_stock === true;
    productModalAddCartBtn.textContent = product.out_of_stock ? 'Agotado' : 'Agregar al carrito';
  }
  
  productModal.classList.add('show');
  openDialog(productModal, document.activeElement, { initialFocus: closeProductModalBtn || productModalAddCartBtn || productModal });
}

// Close product modal
function closeProductModal() {
  closeDialog(productModal, {
    onClose: () => {
      productModal.classList.remove('show');
    }
  });
  currentProductId = null;
}

// Close modal on X button click
if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);

// Close modal on background click
if (productModal) {
  productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
  });
}

// Add to cart from modal
if (productModalAddCartBtn) {
  productModalAddCartBtn.addEventListener('click', () => {
    if (currentProductId) {
      const product = products.find(p => p.id === currentProductId);
      if (product) {
        addToCart(product.name, product.price);
        closeProductModal();
      }
    }
  });
}

// Attach click handlers to all product cards
function initializeProductCards() {
  document.querySelectorAll('.card').forEach((card) => {
    card.style.cursor = 'pointer';
  });
}

// ============================================================
// SIDEBAR MENU WITH CATEGORIES
// ============================================================

async function initializeSidebarMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebarCategories = document.getElementById('sidebarCategories');
  const sidebarSearch = document.getElementById('sidebarSearch');
  const sidebarAccount = document.getElementById('sidebarAccount');
  if (!hamburger || !sidebar || !overlay || !sidebarCategories || !sidebarSearch) return;
  if (sidebar.dataset.initialized === 'true') return;
  sidebar.dataset.initialized = 'true';
  let isSidebarMenuHydrated = false;
  let isSidebarAccountHydrated = false;

  function getCategories() {
    return {
      'Línea Capilar': products.filter(p => p.category === 'capilar' && p.active !== false),
      'Individuales': products.filter(p => p.category === 'individuales' && p.active !== false),
      'Otros': products.filter(p => p.category === 'otros' && p.active !== false)
    };
  }
  
  // Render sidebar categories with search filter
  function renderSidebarMenu(searchTerm = '') {
    sidebarCategories.innerHTML = '';
    const normalizedSearch = normalizeText(searchTerm);
    
    Object.entries(getCategories()).forEach(([categoryName, allCategoryProducts]) => {
      // Filter products by search term
      const categoryProducts = allCategoryProducts.filter(p => 
        normalizeText(p.name).includes(normalizedSearch)
      );
      
      // Only show category if it has products matching the search
      if (categoryProducts.length === 0) return;
      
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'sidebar-category';
      
      const headerBtn = document.createElement('button');
      headerBtn.className = 'sidebar-category-header';
      headerBtn.innerHTML = `
        <span>${categoryName}</span>
        <span class="sidebar-category-toggle">+</span>
      `;
      
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'sidebar-category-items';
      
      categoryProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'sidebar-product-item';
        item.innerHTML = `
          <span class="sidebar-product-name">${escapeHtml(product.name)}</span>
          <span class="sidebar-product-price">${formatPlainRD(getProductCurrentPrice(product))}</span>
        `;
        item.addEventListener('click', () => {
          const section = product.category;
          if (window.location.pathname.endsWith('beautyfast.html')) {
            const tabButton = document.querySelector(`.tabs button[aria-controls="${section}"]`);
            if (tabButton) {
              showSection(section, tabButton);
            }
            closeSidebar();
            document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }

          window.location.href = `beautyfast.html#${section}`;
        });
        itemsContainer.appendChild(item);
      });
      
      headerBtn.addEventListener('click', () => {
        const isOpen = itemsContainer.classList.contains('open');
        itemsContainer.classList.toggle('open');
        headerBtn.querySelector('.sidebar-category-toggle').classList.toggle('open');
      });
      
      categoryDiv.appendChild(headerBtn);
      categoryDiv.appendChild(itemsContainer);
      sidebarCategories.appendChild(categoryDiv);
    });
  }

  function hydrateSidebarMenu() {
    renderSidebarMenu(sidebarSearch.value || '');
    isSidebarMenuHydrated = true;
  }

  async function hydrateSidebarAccount() {
    if (isSidebarAccountHydrated) return;
    await renderSidebarAccount();
    isSidebarAccountHydrated = true;
  }

  window.refreshBeautyfastSidebarMenu = function refreshBeautyfastSidebarMenu() {
    if (!isSidebarMenuHydrated) return;
    renderSidebarMenu(sidebarSearch.value || '');
  };
  
  function openSidebar() {
    if (!isSidebarMenuHydrated) {
      hydrateSidebarMenu();
    }

    if (!isSidebarAccountHydrated) {
      void hydrateSidebarAccount();
    }

    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
  
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }

  async function renderSidebarAccount() {
    if (!sidebarAccount) return;

    if (!window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      sidebarAccount.innerHTML = `
        <div class="sidebar-account-card">
          <p class="sidebar-account-label">Cuenta</p>
          <h3 class="sidebar-account-title">Mis pedidos</h3>
          <p class="sidebar-account-copy">Muy pronto podras entrar aqui para revisar tus compras y ver tu historial.</p>
          <div class="sidebar-account-actions">
            <a href="orders.html" class="sidebar-account-link secondary">Abrir perfil</a>
          </div>
        </div>
      `;
      return;
    }

    const sessionResult = await window.getBeautyfastSession();
    if (!sessionResult.user) {
      sidebarAccount.innerHTML = `
        <div class="sidebar-account-card">
          <p class="sidebar-account-label">Cuenta</p>
          <h3 class="sidebar-account-title">Inicia sesión</h3>
          <p class="sidebar-account-copy">Accede para consultar pedidos, guardar compras y revisar tu historial.</p>
          <div class="sidebar-account-actions">
            <a href="orders.html" class="sidebar-account-link primary">Entrar / Crear cuenta</a>
          </div>
        </div>
      `;
      return;
    }

    const adminResult = window.isBeautyfastAdmin ? await window.isBeautyfastAdmin() : { ok: false, isAdmin: false };

    if (adminResult.ok && adminResult.isAdmin) {
      sidebarAccount.innerHTML = `
        <div class="sidebar-account-card">
          <p class="sidebar-account-label">Administrador</p>
          <h3 class="sidebar-account-title">Cuenta de gestion</h3>
          <p class="sidebar-account-meta">${escapeHtml(sessionResult.user.email)}</p>
          <div class="sidebar-account-actions">
            <a href="admin.html" class="sidebar-account-link primary">Abrir gestion</a>
            <button type="button" class="sidebar-account-button" id="sidebarLogoutBtn">Cerrar sesión</button>
          </div>
        </div>
      `;

      const logoutBtn = document.getElementById('sidebarLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          const result = await window.signOutBeautyfastCustomer();
          if (!result.ok) {
                void fireStorefrontAlert({ icon: 'error', title: 'No pudimos cerrar sesión', text: result.error || 'Inténtalo de nuevo.' });
            return;
          }

          storefrontSessionState = { isAdmin: false, user: null, profile: null };
          applyStorefrontSessionMode();
          await renderSidebarAccount();
          void fireStorefrontAlert({ icon: 'success', title: 'Sesión cerrada', toast: true, position: 'top-end', showConfirmButton: false, timer: 1400 });
        });
      }

      return;
    }

    sidebarAccount.innerHTML = `
      <div class="sidebar-account-card">
        <p class="sidebar-account-label">Cuenta</p>
        <h3 class="sidebar-account-title">Sesión activa</h3>
        <p class="sidebar-account-meta">${escapeHtml(sessionResult.user.email)}</p>
        <div class="sidebar-account-actions">
          <a href="orders.html" class="sidebar-account-link primary">Ver mis pedidos</a>
          <button type="button" class="sidebar-account-button" id="sidebarLogoutBtn">Cerrar sesión</button>
        </div>
      </div>
    `;

    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const result = await window.signOutBeautyfastCustomer();
        if (!result.ok) {
            void fireStorefrontAlert({ icon: 'error', title: 'No pudimos cerrar sesión', text: result.error || 'Inténtalo de nuevo.' });
          return;
        }

        await renderSidebarAccount();
          void fireStorefrontAlert({ icon: 'success', title: 'Sesión cerrada', toast: true, position: 'top-end', showConfirmButton: false, timer: 1400 });
      });
    }
  }
  
  function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }
  
  hamburger.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', closeSidebar);
  
  sidebarSearch.addEventListener('input', (e) => {
    if (!isSidebarMenuHydrated) {
      hydrateSidebarMenu();
    }
    renderSidebarMenu(e.target.value);
  });
  
  const clearSearchBtn = document.getElementById('clearSidebarSearch');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      sidebarSearch.value = '';
      if (!isSidebarMenuHydrated) {
        hydrateSidebarMenu();
      }
      renderSidebarMenu();
      sidebarSearch.focus();
    });
  }
}

async function initializeStorefront() {
  document.body.classList.remove('storefront-ready');

  const storefrontLoader = document.getElementById('storefrontLoader');
  const setStorefrontLoadingState = (isLoading) => {
    if (!storefrontLoader) return;
    storefrontLoader.classList.toggle('is-hidden', !isLoading);
    storefrontLoader.setAttribute('aria-hidden', String(!isLoading));
  };

  setStorefrontLoadingState(true);

  const homeHeroTask = initializeHomeHeroSlider();
  let catalogResult = null;

  try {
    const [, loadedCatalogResult] = await Promise.all([
      resolveStorefrontSessionState(),
      loadProductsCatalog()
    ]);
    catalogResult = loadedCatalogResult;

    initializeWelcomeModal();
    initializeHomeContactForm();
    initializeDeferredHomeSections();
    applyStorefrontSessionMode();
    refreshStorefrontCatalogView();
    document.body.classList.add('storefront-ready');
    setStorefrontLoadingState(false);

    const sidebarTask = initializeSidebarMenu();
    maybeShowWelcomeModal();

    await Promise.allSettled([homeHeroTask, sidebarTask]);

    if (catalogResult?.refreshPromise) {
      void catalogResult.refreshPromise;
    }
  } finally {
    document.body.classList.add('storefront-ready');
    setStorefrontLoadingState(false);
  }
}
await initializeStorefront();
});
