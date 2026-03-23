// Espera a que el DOM cargue antes de ejecutar el JS
document.addEventListener("DOMContentLoaded", function () {

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
    
    // Filter products
    const val = normalizeText(searchInput.value);
    const sectionsAll = document.querySelectorAll(".section");
    const tabButtonsAll = document.querySelectorAll(".tabs button");
    
    if(val==="" && sectionsAll.length && tabButtonsAll.length){
      sectionsAll.forEach((s,i)=>{
        s.classList.remove("active");
        if (tabButtonsAll[i]) tabButtonsAll[i].classList.remove("active");
      });
      sectionsAll[0].classList.add("active");
      tabButtonsAll[0].classList.add("active");
      document.querySelectorAll(".card").forEach(c=>c.style.display="block");
      return;
    }

    let firstSection=null;
    sectionsAll.forEach(section=>{
      const cards=section.querySelectorAll(".card");
      let has=false;
      cards.forEach(card=>{
        const t=normalizeText(card.textContent);
        if(t.includes(val)){
          card.style.display="block";
          has=true;
        } else {
          card.style.display="none";
        }
      });
      if(has && !firstSection) firstSection=section;
    });
    sectionsAll.forEach((s,i)=>{
      s.classList.remove("active");
      if (tabButtonsAll[i]) tabButtonsAll[i].classList.remove("active");
    });
    if(firstSection){
      firstSection.classList.add("active");
      const idx=[...sectionsAll].indexOf(firstSection);
      if (tabButtonsAll[idx]) tabButtonsAll[idx].classList.add("active");
    }
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
function sanitizeCartItem(item) {
  if (!item || typeof item !== "object") return null;

  const name = typeof item.name === "string" ? item.name.trim() : "";
  const image = typeof item.image === "string" ? item.image : "";
  const price = Number(item.price);
  const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));

  if (!name || !Number.isFinite(price) || price < 0) return null;

  return { name, image, price, quantity };
}

function loadStoredCart() {
  const rawCart = localStorage.getItem("cart");
  if (!rawCart) return [];

  try {
    const parsedCart = JSON.parse(rawCart);
    if (!Array.isArray(parsedCart)) throw new Error("Invalid cart payload");

    const sanitizedCart = parsedCart.map(sanitizeCartItem).filter(Boolean);
    if (sanitizedCart.length !== parsedCart.length) {
      localStorage.setItem("cart", JSON.stringify(sanitizedCart));
    }

    return sanitizedCart;
  } catch (error) {
    localStorage.removeItem("cart");
    return [];
  }
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
  user: null
};

function isAdminStorefrontSession() {
  return Boolean(storefrontSessionState.isAdmin);
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
    storefrontSessionState = { isAdmin: false, user: null };
    return storefrontSessionState;
  }

  const sessionResult = await window.getBeautyfastSession();
  if (!sessionResult.user) {
    storefrontSessionState = { isAdmin: false, user: null };
    return storefrontSessionState;
  }

  const adminResult = window.isBeautyfastAdmin ? await window.isBeautyfastAdmin() : { ok: false, isAdmin: false };
  storefrontSessionState = {
    isAdmin: Boolean(adminResult.ok && adminResult.isAdmin),
    user: sessionResult.user
  };

  return storefrontSessionState;
}

function renderHeaderAccount() {
  const headerAccount = document.getElementById('headerAccount');
  if (!headerAccount) return;

  if (isAdminStorefrontSession()) {
    headerAccount.innerHTML = '<a href="admin.html" class="sidebar-btn sidebar-btn-secondary">Panel admin</a>';
    return;
  }

  if (storefrontSessionState.user) {
    headerAccount.innerHTML = '<a href="orders.html" class="sidebar-btn sidebar-btn-secondary">Mis pedidos</a>';
    return;
  }

  headerAccount.innerHTML = '<a href="orders.html" class="sidebar-btn sidebar-btn-secondary">Ingresar</a>';
}

function applyStorefrontSessionMode() {
  const footerOrderLinks = document.querySelectorAll('a[href="orders.html"].footer-link-pill');
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
    return;
  }

  cart = [];
  saveCart();
  updateCartCount();
  closeCartPanel();
  footerOrderLinks.forEach((link) => hideElement(link));
  cartElements.forEach((element) => hideElement(element));
  if (productModalAddCartBtn) hideElement(productModalAddCartBtn);
}

if (cart.length) {
  updateCartCount();
}

// Normalize text for search (remove accents, lowercase)
function normalizeText(text){ return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// ---------------- Funciones básicas ----------------
// Prevenir manipulación de precios: solo se usa el precio interno
window.addToCart = function(name){
  if (isAdminStorefrontSession()) {
    Swal.fire({
      icon: 'info',
      title: 'Cuenta de administrador',
      text: 'La cuenta de administrador no puede agregar productos al carrito.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  const product = products.find(p => p.name === name);
  if (!product) {
    Swal.fire({ icon: 'error', title: 'Producto no encontrado', toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
    return;
  }
  const existing = cart.find(i=>i.name===name);
  const productPrice = getProductCurrentPrice(product);
  if(existing) existing.quantity++;
  else cart.push({name, price: productPrice, quantity:1, image: product.image || ""});
  saveCart(); updateCartCount(); renderCart();
  Swal.fire({ 
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

function saveCart(){ localStorage.setItem("cart",JSON.stringify(cart)); }
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
      item.quantity++;
      saveCart();
      updateCartCount();
      renderCart();
    });

    btnMinus.addEventListener("click", (e) => {
      e.stopPropagation();
      item.quantity--;
      if (item.quantity < 1) item.quantity = 1;
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
      Swal.fire({
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
      Swal.fire({
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

    Swal.fire({
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
      Swal.fire({
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
  document.getElementById(sectionId).classList.add("active");
  const tabButtons=document.querySelectorAll(".tabs button");
  tabButtons.forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
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
  Array.isArray(window.BEAUTYFAST_FALLBACK_PRODUCTS) ? window.BEAUTYFAST_FALLBACK_PRODUCTS : []
);

let products = [...fallbackProducts];

function slugifyProductName(value) {
  return normalizeText(String(value || ''))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProductCurrentPrice(product) {
  const basePrice = Number(product?.price || 0);
  const offerPrice = Number(product?.offer_price || 0);
  if (Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < basePrice) return offerPrice;
  return basePrice;
}

function formatPlainRD(value) {
  return `RD$ ${Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    featured: Boolean(product.featured),
    sort_order: Number.isFinite(Number(product.sort_order)) ? Number(product.sort_order) : index + 1
  };
}

async function loadProductsCatalog() {
  const normalizedFallback = fallbackProducts.map(normalizeProductRecord).filter((product) => product.name);

  if (!window.fetchBeautyfastProducts || !window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
    products = normalizedFallback;
    return { source: 'fallback' };
  }

  const [result, catalogSettingResult] = await Promise.all([
    window.fetchBeautyfastProducts({ activeOnly: true }),
    typeof window.fetchBeautyfastPublicSetting === 'function'
      ? window.fetchBeautyfastPublicSetting('catalog_source')
      : Promise.resolve({ ok: false, data: null })
  ]);

  const catalogMode = catalogSettingResult.ok
    ? String(catalogSettingResult.data?.mode || '').trim().toLowerCase()
    : '';

  if (!result.ok || !result.data.length) {
    if (catalogMode === 'supabase' && result.ok) {
      products = [];
      return { source: 'supabase', empty: true };
    }

    products = normalizedFallback;
    return { source: 'fallback', error: result.error };
  }

  const normalizedRemote = result.data.map(normalizeProductRecord).filter((product) => product.name);

  if (catalogMode === 'supabase') {
    products = normalizedRemote;
    return { source: 'supabase' };
  }

  const mergedProducts = new Map(normalizedFallback.map((product) => [product.slug, product]));

  normalizedRemote.forEach((product) => {
    mergedProducts.set(product.slug, product);
  });

  products = [...mergedProducts.values()].sort((left, right) => left.sort_order - right.sort_order);
  return {
    source: normalizedRemote.length >= normalizedFallback.length ? 'supabase' : 'hybrid'
  };
}

function syncCartProductData() {
  cart = cart.map((item) => {
    const product = products.find((entry) => entry.name === item.name);
    if (!product) return item;

    return {
      ...item,
      price: getProductCurrentPrice(product),
      image: product.image || item.image || ''
    };
  });

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

  cardImage.appendChild(image);

  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';

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
  button.textContent = isAdminStorefrontSession() ? 'Ver detalle' : 'Agregar al carrito';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (isAdminStorefrontSession()) {
      openProductModal(product.id);
      return;
    }
    addToCart(product.name);
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
      .filter((product) => product.category === category && product.active !== false)
      .sort((left, right) => left.sort_order - right.sort_order);

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
  document.querySelectorAll('.card').forEach(card => {
    // Skip adding the click handler to cards that don't have a product ID
    const titleEl = card.querySelector('.card-title');
    if (!titleEl) return;
    
    const productName = titleEl.textContent;
    const product = products.find(p => p.name === productName);
    
    if (product) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        // Don't open modal if clicking the button
        if (e.target.tagName === 'BUTTON') return;
        openProductModal(product.id);
      });
    }
  });
}

// ============================================================
// SIDEBAR MENU WITH CATEGORIES
// ============================================================

function initializeSidebarMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebarCategories = document.getElementById('sidebarCategories');
  const sidebarSearch = document.getElementById('sidebarSearch');
  const sidebarAccount = document.getElementById('sidebarAccount');
  if (!hamburger || !sidebar || !overlay || !sidebarCategories || !sidebarSearch) return;

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

          window.open(`beautyfast.html#${section}`,'_blank');
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
  
  function openSidebar() {
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
          <p class="sidebar-account-copy">Activa Supabase para que tus clientes puedan iniciar sesión y ver su historial.</p>
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
          <h3 class="sidebar-account-title">Panel activo</h3>
          <p class="sidebar-account-meta">${escapeHtml(sessionResult.user.email)}</p>
          <div class="sidebar-account-actions">
            <a href="admin.html" class="sidebar-account-link primary">Abrir panel</a>
            <button type="button" class="sidebar-account-button" id="sidebarLogoutBtn">Cerrar sesión</button>
          </div>
        </div>
      `;

      const logoutBtn = document.getElementById('sidebarLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          const result = await window.signOutBeautyfastCustomer();
          if (!result.ok) {
            if (window.Swal) {
              Swal.fire({ icon: 'error', title: 'No pudimos cerrar sesión', text: result.error || 'Inténtalo de nuevo.' });
            }
            return;
          }

          storefrontSessionState = { isAdmin: false, user: null };
          applyStorefrontSessionMode();
          await renderSidebarAccount();
          if (window.Swal) {
            Swal.fire({ icon: 'success', title: 'Sesión cerrada', toast: true, position: 'top-end', showConfirmButton: false, timer: 1400 });
          }
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
          if (window.Swal) {
            Swal.fire({ icon: 'error', title: 'No pudimos cerrar sesión', text: result.error || 'Inténtalo de nuevo.' });
          }
          return;
        }

        await renderSidebarAccount();
        if (window.Swal) {
          Swal.fire({ icon: 'success', title: 'Sesión cerrada', toast: true, position: 'top-end', showConfirmButton: false, timer: 1400 });
        }
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
    renderSidebarMenu(e.target.value);
  });
  
  const clearSearchBtn = document.getElementById('clearSidebarSearch');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      sidebarSearch.value = '';
      renderSidebarMenu();
      sidebarSearch.focus();
    });
  }
  
  renderSidebarMenu();
  renderSidebarAccount();
}

async function initializeStorefront() {
  await resolveStorefrontSessionState();
  await loadProductsCatalog();
  applyStorefrontSessionMode();
  renderProductCatalog();
  syncCartProductData();
  initializeProductCards();
  initializeSidebarMenu();
}

initializeStorefront();
});
