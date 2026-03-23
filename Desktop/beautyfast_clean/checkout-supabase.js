(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.refreshCheckoutAccountBanner = async function refreshCheckoutAccountBanner() {
    const banner = document.getElementById('checkoutAccountBanner');
    if (!banner) return;

    if (!window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      banner.innerHTML = 'Activa <strong>Supabase</strong> en <a href="supabase-config.js">supabase-config.js</a> para guardar pedidos reales e historial de clientes.';
      return;
    }

    const sessionResult = await window.getBeautyfastSession();
    const adminResult = window.isBeautyfastAdmin ? await window.isBeautyfastAdmin() : { ok: false, isAdmin: false };
    if (adminResult.ok && adminResult.isAdmin) {
      banner.innerHTML = 'La cuenta de administrador no puede usar la pantalla de pago. Usa el panel para gestionar la tienda.';
      return;
    }

    if (sessionResult.user) {
      banner.innerHTML = `Comprando como <strong>${escapeHtml(sessionResult.user.email)}</strong>. Este pedido se guardará en <a href="orders.html">Mis pedidos</a>.`;
      return;
    }

    banner.innerHTML = 'Inicia sesión en <a href="orders.html">Mis pedidos</a> antes de pagar para guardar esta compra en tu historial.';
  };

  window.persistCheckoutOrderSupabase = async function persistCheckoutOrderSupabase(orderPayload) {
    localStorage.setItem('beautyfast:last-order', JSON.stringify(orderPayload));

    if (!window.isBeautyfastSupabaseConfigured || !window.isBeautyfastSupabaseConfigured()) {
      return { saved: false, message: 'Supabase todavía no está configurado.' };
    }

    const adminResult = window.isBeautyfastAdmin ? await window.isBeautyfastAdmin() : { ok: false, isAdmin: false };
    if (adminResult.ok && adminResult.isAdmin) {
      return { saved: false, message: 'La cuenta de administrador no puede registrar compras desde esta pantalla.' };
    }

    const result = await window.saveBeautyfastOrder(orderPayload);
    if (!result.ok) {
      if (result.reason === 'not_authenticated') {
        return { saved: false, message: 'Inicia sesión en Mis pedidos para guardar compras en tu historial.' };
      }

      return { saved: false, message: result.error || 'No pudimos guardar el pedido en Supabase.' };
    }

    return { saved: true, message: 'Pedido guardado en tu historial.' };
  };
})();
