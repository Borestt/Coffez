const API_BASE = (window.ECOFFEE_API_URL || '/api').replace(/\/$/, '');
const CART_USER_KEY = 'ecoffee-cart-user';

const state = { products: [], cart: [], category: 'all', busy: false };
const elements = {
  apiStatus: document.querySelector('#api-status'), apiStatusLabel: document.querySelector('#api-status-label'),
  productGrid: document.querySelector('#product-grid'), catalogError: document.querySelector('#catalog-error'),
  filters: document.querySelector('#filters'), cartDrawer: document.querySelector('#cart-drawer'),
  cartContent: document.querySelector('#cart-content'), cartFooter: document.querySelector('#cart-footer'),
  cartCount: document.querySelector('#cart-count'), drawerCount: document.querySelector('#drawer-count'),
  cartTotal: document.querySelector('#cart-total'), checkoutTotal: document.querySelector('#checkout-total'),
  scrim: document.querySelector('#scrim'), checkoutDialog: document.querySelector('#checkout-dialog'),
  checkoutForm: document.querySelector('#checkout-form'), checkoutButton: document.querySelector('#checkout-button'),
  checkoutMessage: document.querySelector('#checkout-message'), toast: document.querySelector('#toast'),
  receiptPanel: document.querySelector('#receipt-panel'), receiptItems: document.querySelector('#receipt-items'),
  receiptOrderId: document.querySelector('#receipt-order-id'), receiptDate: document.querySelector('#receipt-date'),
  receiptTotal: document.querySelector('#receipt-total')
};

function getUserId() {
  let userId = localStorage.getItem(CART_USER_KEY);
  if (!userId) {
    // The supplied API stores id_usuario as an integer in MySQL.
    userId = String(Math.floor(Math.random() * 2_000_000_000) + 1);
    localStorage.setItem(CART_USER_KEY, userId);
  }
  return userId;
}

function getProductId(product) {
  return String(product?._id ?? product?.id ?? product?.produto ?? '');
}

function getProductName(product) {
  return String(product?.nome ?? product?.name ?? product?.titulo ?? product?.title ?? 'Café especial');
}

function getProductPrice(product) {
  const value = Number(product?.preco ?? product?.price ?? product?.valor ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = { mensagem: raw }; }
  }
  if (!response.ok) {
    throw new Error(data?.mensagem || data?.message || `A API respondeu com erro (${response.status}).`);
  }
  return data;
}

function setApiStatus(online, label) {
  elements.apiStatus.classList.toggle('online', online);
  elements.apiStatus.classList.toggle('offline', !online);
  elements.apiStatusLabel.textContent = label;
}

async function checkApi() {
  try {
    await fetch('/status', { signal: AbortSignal.timeout(4000) }).then(response => {
      if (!response.ok) throw new Error('API indisponível');
    });
    setApiStatus(true, 'Loja conectada');
  } catch {
    setApiStatus(false, 'API desconectada');
  }
}

function extractProducts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.produtos)) return data.produtos;
  if (Array.isArray(data?.products)) return data.products;
  return [];
}

async function loadProducts() {
  elements.catalogError.hidden = true;
  try {
    const data = await apiRequest('/produtos');
    state.products = extractProducts(data);
    renderFilters();
    renderProducts();
    if (!state.products.length) {
      elements.catalogError.textContent = 'Ainda não há produtos cadastrados no catálogo do MongoDB.';
      elements.catalogError.hidden = false;
    }
    setApiStatus(true, 'Loja conectada');
  } catch (error) {
    elements.productGrid.innerHTML = '<div class="empty-products">Não foi possível carregar os cafés agora.</div>';
    elements.catalogError.textContent = `${error.message} Confira se a API está rodando e se GET /api/produtos está disponível.`;
    elements.catalogError.hidden = false;
    setApiStatus(false, 'API desconectada');
  }
}

function getCategories() {
  return [...new Set(state.products.map(product => product.categoria ?? product.category).filter(Boolean).map(String))];
}

function renderFilters() {
  const selected = state.category;
  elements.filters.replaceChildren();
  const categories = [{ value: 'all', label: 'Todos os cafés' }, ...getCategories().map(value => ({ value, label: value }))];
  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-chip${selected === category.value ? ' active' : ''}`;
    button.dataset.category = category.value;
    button.textContent = category.label;
    button.addEventListener('click', () => {
      state.category = category.value;
      renderFilters();
      renderProducts();
    });
    elements.filters.append(button);
  }
  if (!categories.some(category => category.value === selected)) state.category = 'all';
}

function makeProductCard(product, index) {
  const id = getProductId(product);
  const name = getProductName(product);
  const category = product.categoria ?? product.category ?? 'Café especial';
  const description = product.descricao ?? product.description ?? product.origem ?? product.origin ?? 'Uma escolha especial para transformar sua pausa.';
  const card = document.createElement('article');
  card.className = 'product-card';
  const visual = document.createElement('div');
  visual.className = `product-image tone-${(index % 6) + 1}`;
  const badge = document.createElement('span');
  badge.className = 'product-badge';
  badge.textContent = product.badge ?? product.selo ?? 'SELEÇÃO DA CASA';
  const bag = document.createElement('div');
  bag.className = 'bag';
  const brand = document.createElement('span');
  brand.textContent = 'E-COFFEE';
  const origin = document.createElement('small');
  origin.textContent = String(category).toUpperCase();
  bag.append(brand, origin);
  visual.append(badge, bag);
  const info = document.createElement('div');
  info.className = 'product-info';
  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'product-category';
  categoryLabel.textContent = String(category);
  const title = document.createElement('h3');
  title.textContent = name;
  const details = document.createElement('p');
  details.className = 'product-description';
  details.textContent = String(description);
  const meta = document.createElement('div');
  meta.className = 'product-meta';
  const price = document.createElement('span');
  price.className = 'product-price';
  price.textContent = formatPrice(getProductPrice(product));
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-button';
  addButton.textContent = '+';
  addButton.setAttribute('aria-label', `Adicionar ${name} ao carrinho`);
  addButton.addEventListener('click', () => addToCart(product, addButton));
  meta.append(price, addButton);
  info.append(categoryLabel, title, details, meta);
  card.append(visual, info);
  return card;
}

function renderProducts() {
  const visibleProducts = state.products.filter(product => state.category === 'all' || String(product.categoria ?? product.category) === state.category);
  elements.productGrid.replaceChildren();
  if (!visibleProducts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-products';
    empty.textContent = 'Não encontramos produtos nesta categoria.';
    elements.productGrid.append(empty);
    return;
  }
  visibleProducts.forEach((product, index) => elements.productGrid.append(makeProductCard(product, index)));
}

async function addToCart(product, button) {
  const productId = getProductId(product);
  if (!productId) {
    showToast('Este produto não possui um identificador válido.', true);
    return;
  }
  button.disabled = true;
  try {
    await apiRequest('/carrinho', {
      method: 'POST',
      body: JSON.stringify({ idUsuario: getUserId(), produto: productId, quantidade: 1, preco: getProductPrice(product) })
    });
    await loadCart();
    showToast(`${getProductName(product)} adicionado ao carrinho.`);
  } catch (error) {
    showToast(`Não foi possível adicionar: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

function normalizeCartItem(item) {
  const rawProduct = item?.produto && typeof item.produto === 'object' ? item.produto : null;
  const productId = String(rawProduct ? getProductId(rawProduct) : item?.produto ?? item?.productId ?? item?.idProduto ?? '');
  const product = state.products.find(candidate => getProductId(candidate) === productId) || rawProduct || {};
  const quantity = Math.max(1, Number(item?.quantidade ?? item?.quantity ?? 1) || 1);
  const price = Number(item?.preco ?? item?.price ?? getProductPrice(product)) || 0;
  return { id: productId || getProductName(product), name: getProductName(product), quantity, price, total: price * quantity };
}

async function loadCart() {
  try {
    const data = await apiRequest(`/carrinho/${encodeURIComponent(getUserId())}`);
    const items = Array.isArray(data) ? data : (data?.itens ?? data?.items ?? data?.carrinho ?? []);
    const grouped = new Map();
    for (const rawItem of items) {
      const item = normalizeCartItem(rawItem);
      const existing = grouped.get(item.id);
      if (existing) existing.quantity += item.quantity;
      else grouped.set(item.id, item);
    }
    state.cart = [...grouped.values()];
    renderCart();
    return true;
  } catch (error) {
    showToast(`Não foi possível consultar o carrinho: ${error.message}`, true);
    return false;
  }
}

async function removeCartProduct(productId, button) {
  button.disabled = true;
  try {
    await apiRequest(`/carrinho/${encodeURIComponent(getUserId())}/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    await loadCart();
    showToast('Produto removido do carrinho.');
  } catch (error) {
    showToast(`Não foi possível remover: ${error.message}`, true);
    button.disabled = false;
  }
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + item.total, 0);
  elements.cartCount.textContent = String(count);
  elements.drawerCount.textContent = `(${count})`;
  elements.cartTotal.textContent = formatPrice(total);
  elements.checkoutTotal.textContent = formatPrice(total);
  elements.cartFooter.hidden = count === 0;
  elements.cartContent.replaceChildren();
  if (!count) {
    const empty = document.createElement('div');
    empty.className = 'empty-cart';
    empty.innerHTML = '<span>☕</span><strong>Seu carrinho está esperando.</strong><p>Escolha um café para começar uma boa pausa.</p>';
    const browse = document.createElement('button');
    browse.className = 'button button-dark';
    browse.type = 'button';
    browse.textContent = 'Ver cafés';
    browse.addEventListener('click', closeCart);
    empty.append(browse);
    elements.cartContent.append(empty);
    return;
  }
  for (const item of state.cart) {
    const row = document.createElement('article');
    row.className = 'cart-item';
    const thumb = document.createElement('div');
    thumb.className = 'cart-thumb';
    thumb.textContent = '☕';
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = item.name;
    const linePrice = document.createElement('p');
    linePrice.textContent = `${formatPrice(item.price)} cada`;
    details.append(title, linePrice);
    const right = document.createElement('div');
    right.className = 'cart-item-price';
    right.textContent = formatPrice(item.total);
    const controls = document.createElement('div');
    controls.className = 'quantity-controls';
    const qtyLabel = document.createElement('span');
    qtyLabel.textContent = `Qtd. ${item.quantity}`;
    const addMore = document.createElement('button');
    addMore.type = 'button';
    addMore.textContent = '+';
    addMore.setAttribute('aria-label', `Adicionar mais ${item.name}`);
    addMore.addEventListener('click', async () => {
      const product = state.products.find(candidate => getProductId(candidate) === item.id);
      if (product) await addToCart(product, addMore);
    });
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-cart-item';
    removeButton.textContent = 'Remover';
    removeButton.style.cssText = 'border:0;background:transparent;color:#9a5e4f;font-size:9px;text-decoration:underline;cursor:pointer';
    removeButton.addEventListener('click', () => removeCartProduct(item.id, removeButton));
    controls.append(qtyLabel, addMore, removeButton);
    right.append(controls);
    row.append(thumb, details, right);
    elements.cartContent.append(row);
  }
}

function openCart() {
  elements.scrim.hidden = false;
  elements.cartDrawer.classList.add('open');
  elements.cartDrawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  loadCart();
}

function closeCart() {
  elements.scrim.hidden = true;
  elements.cartDrawer.classList.remove('open');
  elements.cartDrawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', isError);
  elements.toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove('show'), 3300);
}

function openCheckout() {
  if (!state.cart.length) return;
  elements.checkoutMessage.textContent = '';
  elements.checkoutMessage.classList.remove('error');
  elements.checkoutForm.hidden = false;
  elements.receiptPanel.hidden = true;
  elements.checkoutDialog.showModal();
}

function showReceipt(order) {
  const items = Array.isArray(order?.itens) && order.itens.length
    ? order.itens
    : state.cart.map(item => ({
      nome: item.name,
      quantidade: item.quantity,
      precoUnitario: item.price,
      subtotal: item.total
    }));
  const orderId = order?.id_pedido ?? order?.idPedido ?? order?.pedido?.id_pedido ?? '—';
  const total = order?.total ?? items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

  elements.receiptOrderId.textContent = String(orderId);
  elements.receiptDate.textContent = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short'
  }).format(new Date());
  elements.receiptTotal.textContent = formatPrice(total);
  elements.receiptItems.replaceChildren();

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'receipt-item';
    const description = document.createElement('span');
    description.className = 'receipt-item-description';
    const name = document.createElement('strong');
    name.textContent = String(item.nome ?? item.name ?? 'Produto');
    const quantity = document.createElement('small');
    quantity.textContent = `${Number(item.quantidade ?? item.quantity ?? 1)} × ${formatPrice(item.precoUnitario ?? item.preco ?? 0)}`;
    description.append(name, quantity);
    const subtotal = document.createElement('strong');
    subtotal.textContent = formatPrice(item.subtotal ?? 0);
    row.append(description, subtotal);
    elements.receiptItems.append(row);
  }

  elements.checkoutForm.hidden = true;
  elements.receiptPanel.hidden = false;
}

async function submitCheckout(event) {
  event.preventDefault();
  if (state.busy || !state.cart.length) return;
  const total = state.cart.reduce((sum, item) => sum + item.total, 0);
  const submitButton = elements.checkoutForm.querySelector('[type="submit"]');
  state.busy = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Processando pedido…';
  elements.checkoutMessage.textContent = '';
  try {
    const result = await apiRequest('/pedidos', {
      method: 'POST',
      body: JSON.stringify({ idUsuario: getUserId(), total })
    });
    showReceipt(result);
    elements.checkoutForm.reset();
    state.cart = [];
    renderCart();
    showToast('Pedido enviado para a API. Obrigado pela compra!');
  } catch (error) {
    elements.checkoutMessage.classList.add('error');
    elements.checkoutMessage.textContent = `Não foi possível finalizar o pedido: ${error.message}`;
  } finally {
    state.busy = false;
    submitButton.disabled = false;
    submitButton.innerHTML = 'Confirmar pedido <span aria-hidden="true">→</span>';
  }
}

document.querySelector('#open-cart').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
document.querySelector('#continue-shopping').addEventListener('click', closeCart);
elements.scrim.addEventListener('click', closeCart);
elements.checkoutButton.addEventListener('click', openCheckout);
document.querySelector('#close-checkout').addEventListener('click', () => elements.checkoutDialog.close());
document.querySelector('#close-receipt').addEventListener('click', () => elements.checkoutDialog.close());
document.querySelector('#done-receipt').addEventListener('click', () => elements.checkoutDialog.close());
document.querySelector('#print-receipt').addEventListener('click', () => window.print());
elements.checkoutForm.addEventListener('submit', submitCheckout);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCart(); });

checkApi();
loadProducts();
