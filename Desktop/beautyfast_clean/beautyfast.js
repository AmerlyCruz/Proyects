// Espera a que el DOM cargue antes de ejecutar el JS
document.addEventListener("DOMContentLoaded", function () {

// change this variable to update business name site-wide
const BUSINESS_NAME = "El Secreto de Aris";

console.log("JS conectado correctamente");

// update header brand text on load
window.addEventListener('DOMContentLoaded', () => {
  const brandLink = document.querySelector('.brand-link');
  if (brandLink) brandLink.textContent = BUSINESS_NAME;
});

// -------- TOGGLE SEARCH BOX --------
const searchToggle = document.getElementById('searchToggle');
const searchInput = document.getElementById('search');
const clearSearchBtn = document.getElementById('clearSearch');

if (searchToggle && searchInput && clearSearchBtn) {
  searchToggle.addEventListener('click', () => {
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
    }
  });

  // close search when user presses Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.classList.remove('active');
      clearSearchBtn.classList.remove('show');
      searchInput.blur();
      searchInput.dispatchEvent(new Event('input'));
    }
  });
}

// ------------ Carrito ----------------
let cart = [];
if(localStorage.getItem("cart")){
  cart = JSON.parse(localStorage.getItem("cart"));
  updateCartCount();
  renderCart();
}

// Normalize text for search (remove accents, lowercase)
function normalizeText(text){ return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// ---------------- Funciones básicas ----------------
// Prevenir manipulación de precios: solo se usa el precio interno
window.addToCart = function(name){
  const product = products.find(p => p.name === name);
  if (!product) {
    Swal.fire({ icon: 'error', title: 'Producto no encontrado', toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
    return;
  }
  const existing = cart.find(i=>i.name===name);
  if(existing) existing.quantity++;
  else cart.push({name, price: product.price, quantity:1});
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

function renderCart(){
  const container = document.getElementById("cartItems"); // contenedor de items
  const totalEl = document.getElementById("cartTotal");  // elemento del total
  const actions = document.querySelector('.cart-actions');
  if (!container || !totalEl) return;
  container.innerHTML = "";
  let total = 0;

  if(cart.length === 0){
    container.innerHTML = '<div style="text-align:center;color:#888;font-size:1.1em;padding:18px 0;">Carrito vacío 🛒</div>';
    totalEl.innerText = "Total: RD$ 0.00";
    if(actions) actions.style.display = 'none';
    return;
  } else {
    if(actions) actions.style.display = '';
  }

  cart.forEach((item,index)=>{
    const div = document.createElement("div");
    div.classList.add("cart-item");
    div.innerHTML=`
      <span>${item.name}</span>
      <div class="qty-control">
        <button class="qty-btn trash"></button>
        <button class="qty-btn minus">−</button>
        <input type="text" value="${item.quantity}" readonly>
        <button class="qty-btn plus">+</button>
      </div>
      <span>${formatRD(item.price*item.quantity)}</span>
    `;
    container.appendChild(div);
    total += item.price*item.quantity;

    const btnTrash = div.querySelector(".trash");
    const btnMinus = div.querySelector(".minus");
    const btnPlus = div.querySelector(".plus");

    if(item.quantity===1){ 
      btnMinus.style.display="none"; 
      btnTrash.style.display="flex"; 
    } else { 
      btnMinus.style.display="flex"; 
      btnTrash.style.display="none"; 
    }

    btnPlus.addEventListener("click", e=>{ e.stopPropagation(); item.quantity++; saveCart(); updateCartCount(); renderCart(); });
    btnMinus.addEventListener("click", e=>{ e.stopPropagation(); item.quantity--; if(item.quantity<1)item.quantity=1; saveCart(); updateCartCount(); renderCart(); });
    btnTrash.addEventListener("click", e=>{ e.stopPropagation(); removeFromCart(index); });
  });

  totalEl.innerText = "Total: "+formatRD(total);
}

// ---------------- Abrir / Cerrar panel y overlay ----------------
const cartIcon = document.querySelector(".cart");
const cartPanel = document.getElementById("cartPanel");      // PANEL del carrito
const closeCartBtn = document.getElementById('closeCart');   // Botón X para cerrar
const cartOverlay = document.getElementById('cartOverlay');  // OVERLAY del carrito

// Abrir panel
if (cartIcon && cartPanel && closeCartBtn && cartOverlay) {
  cartIcon.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cartIcon.click();
    }
  });

  cartIcon.addEventListener("click", e => {
    cartPanel.classList.add("show");
    cartOverlay.classList.add("show"); 
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
  closeCartBtn.addEventListener('click', () => {
    cartPanel.classList.remove("show");
    cartOverlay.classList.remove("show");
  });

  // Cerrar panel al hacer clic en overlay
  cartOverlay.addEventListener('click', () => {
    cartPanel.classList.remove("show");
    cartOverlay.classList.remove("show");
  });

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
    searchInput.dispatchEvent(new Event("input")); 
  });
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================

// Product database
const products = Object.freeze([
  /* Línea Capilar */
  { id: 1, name: 'Línea Pequeña', price: 1050, image: 'img/linea.jpg', description: 'Producto de línea capilar en formato pequeño. Ideal para pruebas y viajes.', category: 'capilar' },
  { id: 2, name: 'Línea Mediana', price: 1350, image: 'img/linea.jpg', description: 'Formato mediano de nuestra línea capilar. Perfecto para uso regular.', category: 'capilar' },
  { id: 3, name: 'Línea Grande', price: 1850, image: 'img/linea.jpg', description: 'Formato grande para uso prolongado. Mayor rendimiento.', category: 'capilar' },
  { id: 4, name: 'Línea Jumbo', price: 2000, image: 'img/linea.jpg', description: 'Formato gigante. La mejor opción para clientes frecuentes.', category: 'capilar' },
  /* Individuales */
  { id: 5, name: 'Shampoo 16 OZ', price: 1200, image: 'img/shampoo16oz.jpg', description: 'Champú premium de 16 oz. Nutre y limpia profundamente tu cabello.', category: 'individuales' },
  { id: 6, name: 'Shampoo 32 OZ', price: 900, image: 'img/shampoo32oz.jpg', description: 'Champú de 32 oz. Oferta especial con mayor volumen a mejor precio.', category: 'individuales' },
  { id: 7, name: 'Tratamiento Intensivo', price: 500, image: 'img/TratInt.jpg', description: 'Tratamiento reparador e intensivo. Restaura la salud de tu cabello.', category: 'individuales' },
  { id: 8, name: 'Gotero', price: 800, image: 'img/gotero4oz.jpg', description: 'Esencia capilar en gotero de 4 oz. Concentrado y de larga duración.', category: 'individuales' },
  { id: 9, name: 'Super Mascarilla', price: 800, image: 'img/SupMask.jpg', description: 'Mascarilla ultra nutritiva. Hidrata y fortalece en profundidad.', category: 'individuales' },
  /* Otros */
  { id: 10, name: 'Aprieta Cuca', price: 1000, image: 'img/linea.jpg', description: 'Producto especial con efectos reafirmantes. Úsalo regularmente para mejores resultados.', category: 'otros' }
]);

const productModal = document.getElementById('productModal');
const closeProductModalBtn = document.getElementById('closeProductModal');
const productModalAddCartBtn = document.getElementById('productModalAddCart');

let currentProductId = null;

// Open product modal
function openProductModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  currentProductId = productId;
  document.getElementById('productModalImage').src = product.image;
  document.getElementById('productModalTitle').textContent = product.name;
  document.getElementById('productModalDesc').textContent = product.description;
  document.getElementById('productModalPrice').textContent = formatRD(product.price);
  
  productModal.classList.add('show');
}

// Close product modal
function closeProductModal() {
  productModal.classList.remove('show');
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
window.addEventListener('DOMContentLoaded', () => {
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
  
  // Initialize sidebar menu with categories
  initializeSidebarMenu();
});

// ============================================================
// SIDEBAR MENU WITH CATEGORIES
// ============================================================

function initializeSidebarMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebarCategories = document.getElementById('sidebarCategories');
  const sidebarSearch = document.getElementById('sidebarSearch');
  if (!hamburger || !sidebar || !overlay || !sidebarCategories || !sidebarSearch) return;
  
  // Group products by category
  const categories = {
    'Línea Capilar': products.filter(p => p.category === 'capilar'),
    'Individuales': products.filter(p => p.category === 'individuales'),
    'Otros': products.filter(p => p.category === 'otros')
  };
  
  // Render sidebar categories with search filter
  function renderSidebarMenu(searchTerm = '') {
    sidebarCategories.innerHTML = '';
    const normalizedSearch = normalizeText(searchTerm);
    
    Object.entries(categories).forEach(([categoryName, allCategoryProducts]) => {
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
          <span class="sidebar-product-name">${product.name}</span>
          <span class="sidebar-product-price">RD$ ${product.price}</span>
        `;
        item.addEventListener('click', () => {
          // Abrir la página de productos en una nueva pestaña y resaltar la sección correspondiente
          let section = '';
          if(product.category === 'capilar') section = 'capilar';
          else if(product.category === 'individuales') section = 'individuales';
          else if(product.category === 'otros') section = 'otros';
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
  
  function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }
  
  // Event listeners
  hamburger.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', closeSidebar);
  
  // Search filter
  sidebarSearch.addEventListener('input', (e) => {
    renderSidebarMenu(e.target.value);
  });
  
  // Clear search button
  const clearSearchBtn = document.getElementById('clearSidebarSearch');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      sidebarSearch.value = '';
      renderSidebarMenu();
      sidebarSearch.focus();
    });
  }
  
  // Render initial menu
  renderSidebarMenu();
}
});

