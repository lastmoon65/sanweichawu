/* Generated from data.js + store.js + app.js for direct file:// use. */
'use strict';
const STORAGE_KEY = 'tea-house-prototype-v1';
const SCHEMA_VERSION = 3;

const MATERIAL_SEED = [
  { id: 'm-dhp', name: '大红袍茶叶', stock: 2000, reserved: 0, unit: '克', warning: 300, price: 0.30 },
  { id: 'm-tgy', name: '铁观音茶叶', stock: 1500, reserved: 0, unit: '克', warning: 300, price: 0.20 },
  { id: 'm-lj', name: '龙井茶叶', stock: 1000, reserved: 0, unit: '克', warning: 200, price: 0.50 },
  { id: 'm-ml', name: '茉莉花茶', stock: 1800, reserved: 0, unit: '克', warning: 300, price: 0.15 },
  { id: 'm-pe', name: '普洱茶', stock: 2000, reserved: 0, unit: '克', warning: 300, price: 0.25 },
  { id: 'm-cup', name: '茶杯', stock: 300, reserved: 0, unit: '个', warning: 50, price: 0.35 },
  { id: 'm-bag', name: '包装袋', stock: 200, reserved: 0, unit: '个', warning: 30, price: 0.20 },
  { id: 'm-wl', name: '碧螺春茶叶', stock: 900, reserved: 0, unit: '克', warning: 180, price: 0.45 },
  { id: 'm-bc', name: '白茶', stock: 1200, reserved: 0, unit: '克', warning: 200, price: 0.32 },
  { id: 'm-hc', name: '红茶', stock: 1100, reserved: 0, unit: '克', warning: 200, price: 0.28 }
];

const PRODUCT_SEED = [
  {
    id: 'p-dhp', name: '大红袍', category: '岩茶', subtitle: '岩骨花香 · 醇厚回甘',
    description: '武夷岩茶代表，火工温润，入口有焙火香与兰花香。适合慢饮，也适合双人分享。',
    theme: 'amber', accent: '#8c522e', active: true,
    variants: [
      { id: 'v-dhp-1', name: '单人份', price: 38, methods: ['盖碗冲泡', '壶泡', '冷泡'], recipe: [{ materialId: 'm-dhp', qty: 8 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-dhp-2', name: '双人份', price: 68, methods: ['盖碗冲泡', '壶泡'], recipe: [{ materialId: 'm-dhp', qty: 15 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-dhp-3', name: '多人壶', price: 98, methods: ['壶泡'], recipe: [{ materialId: 'm-dhp', qty: 22 }, { materialId: 'm-cup', qty: 4 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-tgy', name: '铁观音', category: '乌龙', subtitle: '兰香清幽 · 七泡有余香',
    description: '轻焙火铁观音，香气清扬，汤感柔顺。可选盖碗或功夫泡，突出层次变化。',
    theme: 'gold', accent: '#a87c2d', active: true,
    variants: [
      { id: 'v-tgy-1', name: '单人份', price: 28, methods: ['盖碗冲泡', '功夫泡'], recipe: [{ materialId: 'm-tgy', qty: 7 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-tgy-2', name: '双人份', price: 52, methods: ['盖碗冲泡', '功夫泡'], recipe: [{ materialId: 'm-tgy', qty: 14 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-lj', name: '龙井', category: '绿茶', subtitle: '豆香清新 · 春意入盏',
    description: '鲜嫩龙井，清香甘润。建议低温冲泡，适合玻璃杯欣赏茶芽舒展。',
    theme: 'jade', accent: '#47735a', active: true,
    variants: [
      { id: 'v-lj-1', name: '单人份', price: 35, methods: ['玻璃杯冲泡', '冷泡'], recipe: [{ materialId: 'm-lj', qty: 6 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-lj-2', name: '双人份', price: 65, methods: ['玻璃杯冲泡', '冷泡'], recipe: [{ materialId: 'm-lj', qty: 12 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-wl', name: '碧螺春', category: '绿茶', subtitle: '花果香 · 鲜爽轻盈',
    description: '细嫩芽叶，香气清雅，回甘轻快。冷泡更能突出清甜感。',
    theme: 'mint', accent: '#4e7a63', active: true,
    variants: [
      { id: 'v-wl-1', name: '单人份', price: 42, methods: ['玻璃杯冲泡', '冷泡'], recipe: [{ materialId: 'm-wl', qty: 7 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-wl-2', name: '双人份', price: 78, methods: ['玻璃杯冲泡', '冷泡'], recipe: [{ materialId: 'm-wl', qty: 14 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-ml', name: '茉莉花茶', category: '花茶', subtitle: '窨制花香 · 清甜柔和',
    description: '绿茶坯与茉莉鲜花窨制，花香入水，清甜不腻。适合初次尝试原叶茶的人。',
    theme: 'cream', accent: '#8d7d42', active: true,
    variants: [
      { id: 'v-ml-1', name: '单人份', price: 25, methods: ['盖碗冲泡', '冷泡'], recipe: [{ materialId: 'm-ml', qty: 8 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-ml-2', name: '双人份', price: 48, methods: ['盖碗冲泡', '冷泡'], recipe: [{ materialId: 'm-ml', qty: 16 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-pe', name: '普洱', category: '黑茶', subtitle: '陈香温润 · 醇厚耐泡',
    description: '熟普温润绵滑，陈香明显。适合壶泡慢饮，也适合多人围坐分享。',
    theme: 'umber', accent: '#78513f', active: true,
    variants: [
      { id: 'v-pe-1', name: '单人份', price: 45, methods: ['壶泡', '煮茶'], recipe: [{ materialId: 'm-pe', qty: 9 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-pe-2', name: '多人壶', price: 88, methods: ['壶泡', '煮茶'], recipe: [{ materialId: 'm-pe', qty: 18 }, { materialId: 'm-cup', qty: 3 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-bc', name: '白茶', category: '白茶', subtitle: '毫香清雅 · 甘润自然',
    description: '轻发酵白茶，汤色清亮，甜感柔和。盖碗可感受层次，煮茶更显温润。',
    theme: 'sand', accent: '#96785b', active: true,
    variants: [
      { id: 'v-bc-1', name: '单人份', price: 32, methods: ['盖碗冲泡', '煮茶'], recipe: [{ materialId: 'm-bc', qty: 7 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-bc-2', name: '双人份', price: 60, methods: ['盖碗冲泡', '煮茶'], recipe: [{ materialId: 'm-bc', qty: 14 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  },
  {
    id: 'p-hc', name: '红茶', category: '红茶', subtitle: '蜜香温甜 · 明亮顺滑',
    description: '红茶蜜甜香明显，汤感顺滑。清饮柔和，也可按需冲泡得浓一些。',
    theme: 'ruby', accent: '#934d3f', active: true,
    variants: [
      { id: 'v-hc-1', name: '单人份', price: 30, methods: ['壶泡', '调饮'], recipe: [{ materialId: 'm-hc', qty: 7 }, { materialId: 'm-cup', qty: 1 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] },
      { id: 'v-hc-2', name: '双人份', price: 58, methods: ['壶泡', '调饮'], recipe: [{ materialId: 'm-hc', qty: 14 }, { materialId: 'm-cup', qty: 2 }], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function localDateKey(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateAtOffset(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function money(value) {
  const n = Number(value || 0);
  return `¥${n.toFixed(2)}`;
}

function makeSnapshot(materials, product, variant, qty) {
  const base = variant.recipe.map((r) => {
    const material = materials.find((m) => m.id === r.materialId);
    return material ? { materialId: material.id, name: material.name, unit: material.unit, qty: r.qty * qty, unitPrice: material.price } : null;
  }).filter(Boolean);
  const packaging = (variant.packageExtra || []).map((r) => {
    const material = materials.find((m) => m.id === r.materialId);
    return material ? { materialId: material.id, name: material.name, unit: material.unit, qty: r.qty * qty, unitPrice: material.price } : null;
  }).filter(Boolean);
  const cost = [...base, ...packaging].reduce((sum, m) => sum + m.qty * m.unitPrice, 0);
  return {
    productId: product.id,
    productName: product.name,
    variantId: variant.id,
    variantName: variant.name,
    quantity: qty,
    unitPrice: variant.price,
    subtotal: variant.price * qty,
    materials: base,
    packaging,
    unitCost: cost / qty,
    totalCost: cost
  };
}

function consumeForSeed(state, item, at, orderNo) {
  for (const m of [...item.materials, ...item.packaging]) {
    const material = state.materials.find((x) => x.id === m.materialId);
    if (!material) continue;
    material.stock = Math.max(0, material.stock - m.qty);
    state.inventoryTransactions.push({
      id: `tx-seed-${state.inventoryTransactions.length + 1}`,
      type: 'consumption', materialId: material.id, quantity: -m.qty,
      stockAfter: material.stock, reservedAfter: material.reserved,
      orderId: null, orderNo, note: `演示订单 ${orderNo} 制作消耗`, at
    });
  }
}

function createInitialState() {
  const materials = clone(MATERIAL_SEED);
  const products = clone(PRODUCT_SEED);
  const state = {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: new Date().toISOString(), lastOrderSeq: 1000, lastSessionSeq: 100, lastSettlementSeq: 100, lastPaymentSeq: 100, lastRefundSeq: 100 },
    materials,
    products,
    tables: Array.from({ length: 8 }, (_, i) => ({ id: `T${String(i + 1).padStart(2, '0')}`, capacity: i % 3 === 0 ? 4 : 2 })),
    sessions: [], orders: [], settlements: [], payments: [], refunds: [], inventoryTransactions: [],
    customer: { mode: 'dine', currentTableId: null, cart: [], recentOrderId: null, view: 'catalog', category: '全部' },
    ui: { view: 'customer' }
  };

  const now = Date.now();
  const seedSession = (tableId, orderDefs, closed, discount, paid, minuteOffset) => {
    const sessionId = `S${++state.meta.lastSessionSeq}`;
    const createdAt = new Date(now + minuteOffset * 60000).toISOString();
    const session = { id: sessionId, tableId, status: 'open', openedAt: createdAt, closedAt: null, createdAt };
    state.sessions.push(session);
    for (const def of orderDefs) {
      const product = state.products.find((p) => p.id === def.productId);
      const variant = product.variants.find((v) => v.id === def.variantId);
      const item = makeSnapshot(state.materials, product, variant, def.qty || 1);
      item.options = { strength: def.strength || '适中', method: def.method || variant.methods[0], note: def.note || '' };
      const orderId = `O${++state.meta.lastOrderSeq}`;
      const orderNo = `CY-${String(state.meta.lastOrderSeq).slice(-5)}`;
      const at = new Date(now + (minuteOffset + 3) * 60000).toISOString();
      const order = {
        id: orderId, orderNo, tableId, sessionId, channel: 'dine', status: 'completed',
        items: [item], subtotal: item.subtotal, totalCost: item.totalCost,
        createdAt: at, acceptedAt: at, makingAt: at, completedAt: at, cancelledAt: null,
        cancellationReason: '', lossCost: 0
      };
      state.orders.push(order);
      consumeForSeed(state, item, at, orderNo);
      state.inventoryTransactions.filter((t) => t.orderNo === orderNo).forEach((t) => t.orderId = orderId);
    }
    if (closed) {
      const subtotal = state.orders.filter((o) => o.sessionId === sessionId).reduce((s, o) => s + o.subtotal, 0);
      session.status = 'closed';
      session.closedAt = new Date(now + 20 * 60000).toISOString();
      state.settlements.push({
        id: `SET${++state.meta.lastSettlementSeq}`, sessionId, orderId: null, tableId,
        amountDue: subtotal, discount, paid, unpaid: Math.max(0, subtotal - discount - paid),
        status: 'closed', createdAt: new Date(now + 15 * 60000).toISOString(), updatedAt: session.closedAt
      });
    }
    return session;
  };

  seedSession('T03', [
    { productId: 'p-dhp', variantId: 'v-dhp-1', strength: '浓郁', method: '盖碗冲泡', note: '第二泡稍淡' },
    { productId: 'p-lj', variantId: 'v-lj-1', strength: '适中', method: '玻璃杯冲泡' }
  ], true, 3, 70, -125);
  seedSession('T07', [
    { productId: 'p-pe', variantId: 'v-pe-2', strength: '适中', method: '壶泡', note: '四人围坐，加杯' }
  ], false, 0, 0, -55);

  const takeawayProduct = state.products.find((p) => p.id === 'p-ml');
  const takeawayVariant = takeawayProduct.variants[0];
  const takeawayItem = makeSnapshot(state.materials, takeawayProduct, takeawayVariant, 1);
  takeawayItem.options = { strength: '清淡', method: '冷泡', note: '少冰' };
  const takeawayId = `O${++state.meta.lastOrderSeq}`;
  const takeawayNo = `CY-${String(state.meta.lastOrderSeq).slice(-5)}`;
  const takeawayAt = new Date(now - 35 * 60000).toISOString();
  state.orders.push({
    id: takeawayId, orderNo: takeawayNo, tableId: null, sessionId: null, channel: 'takeaway', status: 'completed',
    items: [takeawayItem], subtotal: 25, totalCost: takeawayItem.totalCost,
    createdAt: takeawayAt, acceptedAt: takeawayAt, makingAt: takeawayAt, completedAt: takeawayAt, cancelledAt: null,
    cancellationReason: '', lossCost: 0
  });
  consumeForSeed(state, takeawayItem, takeawayAt, takeawayNo);
  state.inventoryTransactions.filter((t) => t.orderNo === takeawayNo).forEach((t) => t.orderId = takeawayId);
  state.payments.push({
    id: `PAY${++state.meta.lastPaymentSeq}`, paymentNo: `PAY-${String(state.meta.lastPaymentSeq).slice(-5)}`,
    orderId: takeawayId, sessionId: null, amount: 25, status: 'ACTIVE',
    receivedAt: takeawayAt, note: '演示订单：店员确认实际收款'
  });

  return state;
}



const STATUS_LABEL = {
  pending: '待接单', accepted: '待制作', making: '制作中', completed: '已完成', cancelled: '已取消'
};
const TX_LABEL = {
  reserve: '库存预占', release: '释放预占', consumption: '制作消耗', loss: '取消损耗', stock_in: '手动入库', adjustment: '库存调整'
};

class TeaStore {
  constructor() {
    this.state = this.load();
    this.listeners = new Set();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.products || !parsed.orders) return createInitialState();
      return parsed;
    } catch (error) {
      console.warn('原型数据读取失败，已恢复默认数据', error);
      return createInitialState();
    }
  }

  save() {
    this.state.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((fn) => fn(this.state));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset() {
    this.state = createInitialState();
    this.save();
  }

  setView(view) {
    this.state.ui.view = view;
    this.save();
  }

  setCustomerView(view) {
    this.state.customer.view = view;
    this.save();
  }

  setCustomerMode(mode) {
    this.state.customer.mode = mode;
    if (mode === 'takeaway') this.state.customer.currentTableId = null;
    this.state.customer.cart = [];
    this.save();
  }

  scanTable(tableId) {
    this.state.customer.mode = 'dine';
    this.state.customer.currentTableId = tableId;
    this.state.customer.recentOrderId = null;
    this.state.customer.view = 'catalog';
    this.save();
  }

  clearScan() {
    this.state.customer.mode = 'dine';
    this.state.customer.currentTableId = null;
    this.state.customer.recentOrderId = null;
    this.state.customer.view = 'catalog';
    this.state.customer.cart = [];
    this.save();
  }

  setCategory(category) {
    this.state.customer.category = category;
    this.save();
  }

  getProduct(productId) {
    return this.state.products.find((p) => p.id === productId);
  }

  getVariant(productId, variantId) {
    return this.getProduct(productId)?.variants.find((v) => v.id === variantId);
  }

  getMaterial(materialId) {
    return this.state.materials.find((m) => m.id === materialId);
  }

  getOrder(orderId) {
    return this.state.orders.find((o) => o.id === orderId);
  }

  getOpenSession(tableId) {
    return [...this.state.sessions].reverse().find((s) => s.tableId === tableId && s.status !== 'closed');
  }

  getSession(sessionId) {
    return this.state.sessions.find((s) => s.id === sessionId);
  }

  getSessionOrders(sessionId, includeCancelled = true) {
    return this.state.orders.filter((o) => o.sessionId === sessionId && (includeCancelled || o.status !== 'cancelled'));
  }

  getTableStatus(tableId) {
    const session = this.getOpenSession(tableId);
    if (!session) return 'free';
    const active = this.getSessionOrders(session.id, true);
    const unfinished = active.some((o) => ['pending', 'accepted', 'making'].includes(o.status));
    return unfinished ? 'dining' : 'settling';
  }

  buildRequirements(variant, mode, quantity = 1) {
    const entries = [...(variant.recipe || []), ...((mode === 'takeaway' ? variant.packageExtra : []) || [])];
    const totals = new Map();
    for (const entry of entries) {
      const qty = Number(entry.qty) * Number(quantity);
      totals.set(entry.materialId, (totals.get(entry.materialId) || 0) + qty);
    }
    return [...totals.entries()].map(([materialId, qty]) => ({ materialId, qty }));
  }

  requirementAvailability(requirements) {
    const shortages = [];
    for (const req of requirements) {
      const material = this.getMaterial(req.materialId);
      if (!material) {
        shortages.push({ materialId: req.materialId, name: '未知原料', needed: req.qty, available: 0, unit: '' });
        continue;
      }
      const available = Math.max(0, Number(material.stock) - Number(material.reserved));
      if (available + 0.0001 < req.qty) {
        shortages.push({ materialId: material.id, name: material.name, needed: req.qty, available, unit: material.unit });
      }
    }
    return shortages;
  }

  canMakeVariant(variant, mode, quantity = 1) {
    return this.requirementAvailability(this.buildRequirements(variant, mode, quantity)).length === 0;
  }

  productInStock(product, mode) {
    return product.active && product.variants.some((v) => this.canMakeVariant(v, mode));
  }

  getCartRequirements() {
    const totals = new Map();
    for (const line of this.state.customer.cart) {
      const product = this.getProduct(line.productId);
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!variant) continue;
      for (const req of this.buildRequirements(variant, this.state.customer.mode, line.quantity)) {
        totals.set(req.materialId, (totals.get(req.materialId) || 0) + req.qty);
      }
    }
    return [...totals.entries()].map(([materialId, qty]) => ({ materialId, qty }));
  }

  addToCart(payload) {
    const { productId, variantId, quantity, strength, method, note } = payload;
    const product = this.getProduct(productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return { ok: false, message: '商品或规格不存在' };
    const requested = Number(quantity || 1);
    const batchReq = this.buildRequirements(variant, this.state.customer.mode, requested);
    const cartReq = this.getCartRequirements();
    const merged = new Map(batchReq.map((r) => [r.materialId, r.qty]));
    for (const r of cartReq) merged.set(r.materialId, (merged.get(r.materialId) || 0) + r.qty);
    const shortages = this.requirementAvailability([...merged.entries()].map(([materialId, qty]) => ({ materialId, qty })));
    if (shortages.length) return { ok: false, shortages };
    const identical = this.state.customer.cart.find((line) => line.productId === productId && line.variantId === variantId && line.strength === strength && line.method === method && line.note === note);
    if (identical) identical.quantity += requested;
    else {
      this.state.customer.cart.push({
        lineId: `L${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
        productId, variantId, quantity: requested, strength, method, note: note || ''
      });
    }
    this.state.customer.view = 'catalog';
    this.save();
    return { ok: true };
  }

  updateCartQuantity(lineId, delta) {
    const line = this.state.customer.cart.find((l) => l.lineId === lineId);
    if (!line) return { ok: false };
    const next = Math.max(1, line.quantity + delta);
    if (delta > 0) {
      const variant = this.getVariant(line.productId, line.variantId);
      if (!variant) return { ok: false, message: '规格不存在' };
      const totals = new Map();
      for (const cartLine of this.state.customer.cart) {
        const cartVariant = this.getVariant(cartLine.productId, cartLine.variantId);
        if (!cartVariant) continue;
        const quantity = cartLine.lineId === lineId ? next : cartLine.quantity;
        for (const req of this.buildRequirements(cartVariant, this.state.customer.mode, quantity)) {
          totals.set(req.materialId, (totals.get(req.materialId) || 0) + req.qty);
        }
      }
      const shortages = this.requirementAvailability([...totals.entries()].map(([materialId, qty]) => ({ materialId, qty })));
      if (shortages.length) return { ok: false, shortages };
    }
    line.quantity = next;
    this.save();
    return { ok: true };
  }

  updateCartLine(lineId, payload) {
    const line = this.state.customer.cart.find((l) => l.lineId === lineId);
    if (!line) return { ok: false, message: '购物车项目不存在' };
    const variant = this.getVariant(payload.productId, payload.variantId);
    if (!variant) return { ok: false, message: '商品规格不存在' };
    const totals = new Map();
    for (const cartLine of this.state.customer.cart) {
      const currentVariant = this.getVariant(cartLine.productId, cartLine.variantId);
      if (!currentVariant || cartLine.lineId === lineId) continue;
      for (const req of this.buildRequirements(currentVariant, this.state.customer.mode, cartLine.quantity)) totals.set(req.materialId, (totals.get(req.materialId) || 0) + req.qty);
    }
    for (const req of this.buildRequirements(variant, this.state.customer.mode, payload.quantity)) totals.set(req.materialId, (totals.get(req.materialId) || 0) + req.qty);
    const shortages = this.requirementAvailability([...totals.entries()].map(([materialId, qty]) => ({ materialId, qty })));
    if (shortages.length) return { ok: false, shortages };
    Object.assign(line, { productId: payload.productId, variantId: payload.variantId, quantity: payload.quantity, strength: payload.strength, method: payload.method, note: payload.note || '' });
    this.save();
    return { ok: true };
  }

  removeCartLine(lineId) {
    this.state.customer.cart = this.state.customer.cart.filter((l) => l.lineId !== lineId);
    this.save();
  }

  clearCart() {
    this.state.customer.cart = [];
    this.save();
  }

  makeItemSnapshot(line) {
    const product = this.getProduct(line.productId);
    const variant = product.variants.find((v) => v.id === line.variantId);
    const item = makeSnapshot(this.state.materials, product, variant, line.quantity);
    item.options = { strength: line.strength, method: line.method, note: line.note };
    return item;
  }

  submitOrder() {
    const cart = this.state.customer.cart;
    if (!cart.length) return { ok: false, message: '购物车为空' };
    if (this.state.customer.mode === 'dine' && !this.state.customer.currentTableId) return { ok: false, message: '请先扫描桌码' };
    const requirements = this.getCartRequirements();
    const shortages = this.requirementAvailability(requirements);
    if (shortages.length) return { ok: false, shortages };

    let session = null;
    if (this.state.customer.mode === 'dine') {
      session = this.getOpenSession(this.state.customer.currentTableId);
      if (!session) {
        const id = `S${++this.state.meta.lastSessionSeq}`;
        session = { id, tableId: this.state.customer.currentTableId, status: 'open', openedAt: new Date().toISOString(), closedAt: null, createdAt: new Date().toISOString() };
        this.state.sessions.push(session);
      }
    }

    const items = cart.map((line) => this.makeItemSnapshot(line));
    const id = `O${++this.state.meta.lastOrderSeq}`;
    const orderNo = `CY-${String(this.state.meta.lastOrderSeq).slice(-5)}`;
    const now = new Date().toISOString();
    const order = {
      id, orderNo, tableId: session?.tableId || null, sessionId: session?.id || null,
      channel: this.state.customer.mode, status: 'pending', items,
      subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
      totalCost: items.reduce((sum, item) => sum + item.totalCost, 0),
      createdAt: now, acceptedAt: null, makingAt: null, completedAt: null, cancelledAt: null,
      cancellationReason: '', lossCost: 0
    };

    for (const req of requirements) {
      const material = this.getMaterial(req.materialId);
      material.reserved = Number(material.reserved || 0) + req.qty;
      this.state.inventoryTransactions.push({
        id: `TX${Date.now()}${Math.random().toString(16).slice(2, 5)}`, type: 'reserve', materialId: material.id,
        quantity: 0, reservedDelta: req.qty, stockAfter: material.stock, reservedAfter: material.reserved,
        orderId: id, orderNo, note: `订单 ${orderNo} 预占`, at: now
      });
    }

    this.state.orders.unshift(order);
    this.state.customer.cart = [];
    this.state.customer.recentOrderId = id;
    this.state.customer.view = 'orders';
    this.save();
    return { ok: true, order };
  }

  transitionOrder(orderId, nextStatus) {
    const order = this.getOrder(orderId);
    if (!order) return { ok: false, message: '订单不存在' };
    const allowed = {
      pending: ['accepted', 'cancelled'], accepted: ['making', 'cancelled'],
      making: ['completed', 'cancelled'], completed: [], cancelled: []
    };
    if (!allowed[order.status]?.includes(nextStatus)) return { ok: false, message: '当前状态不允许此操作' };
    const now = new Date().toISOString();

    if (nextStatus === 'accepted') order.acceptedAt = now;
    if (nextStatus === 'making') {
      order.makingAt = now;
      for (const item of order.items) {
        for (const req of [...item.materials, ...item.packaging]) {
          const material = this.getMaterial(req.materialId);
          if (!material) continue;
          material.reserved = Math.max(0, Number(material.reserved || 0) - req.qty);
          material.stock = Math.max(0, Number(material.stock || 0) - req.qty);
          this.state.inventoryTransactions.push({
            id: `TX${Date.now()}${Math.random().toString(16).slice(2, 6)}`, type: 'consumption', materialId: material.id,
            quantity: -req.qty, reservedDelta: -req.qty, stockAfter: material.stock, reservedAfter: material.reserved,
            orderId: order.id, orderNo: order.orderNo, note: `订单 ${order.orderNo} 开始制作，转为实际消耗`, at: now
          });
        }
      }
    }
    if (nextStatus === 'completed') {
      order.completedAt = now;
    }
    if (nextStatus === 'cancelled') {
      if (order.channel === 'takeaway' && this.getOrderNetPaid(order.id) > 0) return { ok: false, message: '该打包订单已有实收记录，请先登记退款后再取消' };
      if (order.sessionId) {
        const current = this.getSessionMoney(order.sessionId);
        const remainingSubtotal = Math.max(0, current.subtotal - order.subtotal);
        const remainingDue = Math.max(0, remainingSubtotal - current.discount);
        if (current.paid > remainingDue) return { ok: false, message: '取消后应收低于已记实收，请先登记退款后再取消' };
      }
      order.cancelledAt = now;
      if (order.status !== 'making') {
        for (const item of order.items) {
          for (const req of [...item.materials, ...item.packaging]) {
            const material = this.getMaterial(req.materialId);
            if (!material) continue;
            material.reserved = Math.max(0, Number(material.reserved || 0) - req.qty);
            this.state.inventoryTransactions.push({
              id: `TX${Date.now()}${Math.random().toString(16).slice(2, 6)}`, type: 'release', materialId: material.id,
              quantity: 0, reservedDelta: -req.qty, stockAfter: material.stock, reservedAfter: material.reserved,
              orderId: order.id, orderNo: order.orderNo, note: `订单 ${order.orderNo} 取消，释放预占`, at: now
            });
          }
        }
      } else {
        order.lossCost = order.totalCost;
        const byMaterial = new Map();
        for (const item of order.items) {
          for (const req of [...item.materials, ...item.packaging]) byMaterial.set(req.materialId, (byMaterial.get(req.materialId) || 0) + req.qty);
        }
        for (const [materialId, qty] of byMaterial.entries()) {
          const material = this.getMaterial(materialId);
          if (!material) continue;
          this.state.inventoryTransactions.push({
            id: `TX${Date.now()}${Math.random().toString(16).slice(2, 6)}`, type: 'loss', materialId,
            quantity: 0, lossQuantity: qty, stockAfter: material.stock, reservedAfter: material.reserved,
            orderId: order.id, orderNo: order.orderNo, note: `订单 ${order.orderNo} 制作后取消，计入损耗`, at: now
          });
        }
      }
    }
    order.status = nextStatus;
    this.save();
    return { ok: true, order };
  }

  getOrderPaid(orderId) {
    return (this.state.payments || [])
      .filter((p) => p.orderId === orderId && p.status === 'ACTIVE')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }

  getPaymentRefunded(paymentId) {
    return (this.state.refunds || [])
      .filter((r) => r.paymentId === paymentId && r.status === 'ACTIVE')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  getOrderRefunded(orderId) {
    const paymentIds = new Set((this.state.payments || []).filter((p) => p.orderId === orderId).map((p) => p.id));
    return (this.state.refunds || [])
      .filter((r) => paymentIds.has(r.paymentId) && r.status === 'ACTIVE')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }

  getOrderNetPaid(orderId) {
    return Math.max(0, this.getOrderPaid(orderId) - this.getOrderRefunded(orderId));
  }

  recordRefund(paymentId, amount, reason) {
    const payment = (this.state.payments || []).find((p) => p.id === paymentId && p.status === 'ACTIVE');
    if (!payment) return { ok: false, message: '原收款记录不存在或已作废' };
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, message: '请输入有效退款金额' };
    const refunded = this.getPaymentRefunded(payment.id);
    if (refunded + value > Number(payment.amount) + 0.0001) return { ok: false, message: `累计退款不能超过原收款，剩余可退 ${money(Number(payment.amount) - refunded)}` };
    this.state.refunds = this.state.refunds || [];
    this.state.refunds.unshift({
      id: `REF${++this.state.meta.lastRefundSeq}`,
      refundNo: `REF-${String(this.state.meta.lastRefundSeq).slice(-5)}`,
      paymentId: payment.id,
      orderId: payment.orderId || null,
      sessionId: payment.sessionId || null,
      amount: value,
      reason,
      status: 'ACTIVE',
      refundedAt: new Date().toISOString()
    });
    this.save();
    return { ok: true };
  }
  recordTakeawayPayment(orderId, amount, note = '') {
    const order = this.getOrder(orderId);
    if (!order || order.channel !== 'takeaway') return { ok: false, message: '打包订单不存在' };
    if (order.status === 'cancelled') return { ok: false, message: '已取消订单不能登记收款' };
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, message: '请输入有效收款金额' };
    const paid = this.getOrderNetPaid(order.id);
    const due = Math.max(0, Number(order.subtotal || 0) - Number(order.discountFen || 0));
    if (paid + value > due + 0.0001) return { ok: false, message: `本次收款超过未结金额 ${money(due - paid)}` };
    const now = new Date().toISOString();
    this.state.payments = this.state.payments || [];
    this.state.payments.unshift({
      id: `PAY${++this.state.meta.lastPaymentSeq}`,
      paymentNo: `PAY-${String(this.state.meta.lastPaymentSeq).slice(-5)}`,
      orderId: order.id, sessionId: null, amount: value, status: 'ACTIVE',
      receivedAt: now, note
    });
    this.save();
    return { ok: true };
  }

  getSessionMoney(sessionId) {
    const orders = this.getSessionOrders(sessionId, false);
    const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
    const settlement = this.state.settlements.find((s) => s.sessionId === sessionId);
    const discount = settlement?.discount || 0;
    const paid = settlement?.paid || 0;
    const amountDue = Math.max(0, subtotal - discount);
    return { subtotal, discount, paid, amountDue, unpaid: Math.max(0, amountDue - paid), settlement, orders };
  }

  settleTable(sessionId, rawDiscount, rawPaid) {
    const session = this.getSession(sessionId);
    if (!session) return { ok: false, message: '桌单不存在' };
    const money = this.getSessionMoney(sessionId);
    const unfinished = money.orders.some((o) => ['pending', 'accepted', 'making'].includes(o.status));
    if (unfinished) return { ok: false, message: '仍有未完成订单，不能关闭桌单' };
    const discount = Math.min(money.subtotal, Math.max(0, Number(rawDiscount || 0)));
    const amountDue = Math.max(0, money.subtotal - discount);
    const paid = Math.min(amountDue, Math.max(0, Number(rawPaid || 0)));
    const unpaid = Math.max(0, amountDue - paid);
    let settlement = money.settlement;
    if (!settlement) {
      settlement = { id: `SET${++this.state.meta.lastSettlementSeq}`, sessionId, orderId: null, tableId: session.tableId };
      this.state.settlements.unshift(settlement);
    }
    Object.assign(settlement, { amountDue, discount, paid, unpaid, status: unpaid === 0 ? 'closed' : 'open', updatedAt: new Date().toISOString() });
    if (unpaid === 0) {
      session.status = 'closed';
      session.closedAt = settlement.updatedAt;
    } else {
      session.status = 'open';
      session.closedAt = null;
    }
    this.save();
    return { ok: true, settlement, closed: unpaid === 0 };
  }

  stockIn(materialId, qty, note) {
    const material = this.getMaterial(materialId);
    const amount = Number(qty);
    if (!material || !Number.isFinite(amount) || amount <= 0) return { ok: false, message: '请输入有效入库数量' };
    material.stock = Number(material.stock) + amount;
    this.state.inventoryTransactions.unshift({
      id: `TX${Date.now()}${Math.random().toString(16).slice(2, 6)}`, type: 'stock_in', materialId,
      quantity: amount, reservedDelta: 0, stockAfter: material.stock, reservedAfter: material.reserved,
      orderId: null, orderNo: null, note: note || '手动入库', at: new Date().toISOString()
    });
    this.save();
    return { ok: true };
  }

  adjustStock(materialId, nextStock, note) {
    const material = this.getMaterial(materialId);
    const amount = Number(nextStock);
    if (!material || !Number.isFinite(amount) || amount < 0) return { ok: false, message: '库存不能为负数' };
    const delta = amount - Number(material.stock);
    material.stock = amount;
    this.state.inventoryTransactions.unshift({
      id: `TX${Date.now()}${Math.random().toString(16).slice(2, 6)}`, type: 'adjustment', materialId,
      quantity: delta, reservedDelta: 0, stockAfter: material.stock, reservedAfter: material.reserved,
      orderId: null, orderNo: null, note: note || '人工盘点调整', at: new Date().toISOString()
    });
    this.save();
    return { ok: true };
  }

  saveMaterial(input) {
    if (input.id) {
      const material = this.getMaterial(input.id);
      if (!material) return { ok: false, message: '原料不存在' };
      Object.assign(material, {
        name: String(input.name).trim(), unit: String(input.unit).trim(), warning: Math.max(0, Number(input.warning || 0)), price: Math.max(0, Number(input.price || 0))
      });
    } else {
      const id = `m-${Date.now()}`;
      this.state.materials.push({ id, name: String(input.name).trim(), unit: String(input.unit).trim(), stock: Math.max(0, Number(input.stock || 0)), reserved: 0, warning: Math.max(0, Number(input.warning || 0)), price: Math.max(0, Number(input.price || 0)) });
    }
    this.save();
    return { ok: true };
  }

  saveProduct(input) {
    const data = clone(input);
    if (!data.id) data.id = `p-${Date.now()}`;
    data.active = data.active !== false;
    data.variants = (data.variants?.length ? data.variants : [{ name: '标准份', price: data.price || 0, methods: ['标准冲泡'], recipe: [], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }]).map((v, i) => ({
      ...v,
      id: v.id || `v-${data.id}-${i + 1}`,
      methods: v.methods?.length ? v.methods : ['标准冲泡']
    }));
    if (input.id) {
      const product = this.getProduct(input.id);
      if (!product) return { ok: false, message: '商品不存在' };
      Object.assign(product, data);
    } else {
      this.state.products.push(data);
    }
    this.save();
    return { ok: true };
  }

  saveRecipe(productId, variantId, recipe, packageExtra) {
    const variant = this.getVariant(productId, variantId);
    if (!variant) return { ok: false, message: '规格不存在' };
    variant.recipe = recipe.filter((r) => r.materialId && Number(r.qty) > 0).map((r) => ({ materialId: r.materialId, qty: Number(r.qty) }));
    variant.packageExtra = packageExtra.filter((r) => r.materialId && Number(r.qty) > 0).map((r) => ({ materialId: r.materialId, qty: Number(r.qty) }));
    this.save();
    return { ok: true };
  }

  recipeCost(variant) {
    return [...(variant.recipe || []), ...(variant.packageExtra || [])].reduce((sum, r) => {
      const material = this.getMaterial(r.materialId);
      return sum + Number(r.qty || 0) * Number(material?.price || 0);
    }, 0);
  }
}



const store = new TeaStore();
let ui = {
  modal: null,
  detail: null,
  workFilter: 'active',
  inventoryTab: 'products',
  rankingMetric: 'gross',
  tableId: null,
  recipe: null,
  productForm: null,
  materialForm: null,
  stockMove: null,
  historyMaterialId: null,
  confirmReset: false
};
let toastTimer = null;

const viewNames = {
  customer: '顾客点单', workbench: '店员工作台', tables: '桌位与结账', inventory: '商品与库存', analytics: '经营分析'
};
const statusClass = { pending: 'warn', accepted: 'info', making: 'active', completed: 'success', cancelled: 'muted' };
const themes = ['amber', 'gold', 'jade', 'mint', 'cream', 'umber', 'sand', 'ruby', 'forest'];
const themeLabels = { amber: '岩茶琥珀', gold: '乌龙金色', jade: '春茶青绿', mint: '碧螺清绿', cream: '茉莉米白', umber: '普洱深褐', sand: '白茶浅木', ruby: '红茶绯红', forest: '山林墨绿' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function fmtTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function fmtDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function todayLabel() {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
}

function notify(message, tone = 'default') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast ${tone}">${esc(message)}</div>`;
  requestAnimationFrame(() => root.firstElementChild?.classList.add('show'));
  toastTimer = setTimeout(() => {
    root.firstElementChild?.classList.remove('show');
    setTimeout(() => { root.innerHTML = ''; }, 220);
  }, 3000);
}

function productArt(product, compact = false) {
  const theme = themes.includes(product.theme) ? product.theme : 'jade';
  return `<div class="tea-art theme-${theme} ${compact ? 'compact' : ''}" style="--tea-accent:${esc(product.accent || '#47735a')}">
    <svg viewBox="0 0 240 170" aria-hidden="true">
      <defs><linearGradient id="glass-${esc(product.id)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".72"/><stop offset="1" stop-color="#fff" stop-opacity=".16"/></linearGradient></defs>
      <path class="steam s1" d="M92 52c-12-15 9-20 0-36" />
      <path class="steam s2" d="M120 49c-11-13 9-20 0-32" />
      <path class="steam s3" d="M146 53c-10-13 10-18 0-32" />
      <path class="leaf l1" d="M185 31c-28 1-43 16-47 37 26 2 43-12 47-37Z" />
      <path class="leaf l2" d="M43 108c-12 18-4 34 16 39 7-19-1-34-16-39Z" />
      <path class="saucer" d="M64 138h112c-7 10-27 15-56 15s-49-5-56-15Z" />
      <path class="glass" d="M73 68h94l-11 61c-2 10-13 17-36 17s-34-7-36-17L73 68Z" fill="url(#glass-${esc(product.id)})" />
      <path class="tea" d="M81 97h78l-7 34c-2 8-12 13-32 13s-30-5-32-13l-7-34Z" />
      <path class="handle" d="M165 84c22-2 28 21 8 31" />
      <circle class="bubble b1" cx="105" cy="115" r="4"/><circle class="bubble b2" cx="126" cy="108" r="3"/><circle class="bubble b3" cx="139" cy="123" r="2"/>
    </svg>
    <span class="art-caption">${esc(product.category)}</span>
  </div>`;
}

function takeawayPaymentSummary(order) {
  const grossPaid = store.getOrderPaid(order.id);
  const refunded = store.getOrderRefunded(order.id);
  const paid = Math.max(0, grossPaid - refunded);
  const due = Math.max(0, Number(order.subtotal || 0) - Number(order.discountFen || 0));
  return { grossPaid, refunded, paid, due, unpaid: Math.max(0, due - paid) };
}
function statusPill(status) {
  return `<span class="status-pill ${statusClass[status] || ''}">${STATUS_LABEL[status] || status}</span>`;
}

function emptyState(title, copy, action = '') {
  return `<div class="empty-state"><div class="empty-mark">茶</div><h3>${esc(title)}</h3><p>${esc(copy)}</p>${action}</div>`;
}

function renderHeader() {
  const current = store.state.ui.view;
  const nav = [
    ['customer', '顾客点单'], ['workbench', '店员工作台'], ['tables', '桌位与结账'], ['inventory', '商品与库存'], ['analytics', '经营分析']
  ];
  return `<header class="app-header">
    <div class="brand-block" data-action="go-customer" role="button" tabindex="0">
      <div class="brand-mark"><span class="brand-leaf"></span></div>
      <div><div class="brand-name">山隐茶事</div><div class="brand-sub">单店经营原型 · TEAHOUSE OS</div></div>
    </div>
    <nav class="role-nav" aria-label="角色切换">
      ${nav.map(([id, label]) => `<button class="nav-pill ${current === id ? 'active' : ''}" data-view="${id}"><span>${label}</span></button>`).join('')}
    </nav>
    <div class="header-actions">
      <span class="demo-tag"><i></i> 纯前端演示</span>
      <button class="icon-btn reset-btn" data-action="confirm-reset" title="重置演示数据" aria-label="重置演示数据">↺</button>
    </div>
  </header>`;
}

function customerTop(mode) {
  const table = store.state.customer.currentTableId;
  const label = mode === 'takeaway' ? '打包外带' : table ? `堂饮 · ${table}` : '尚未扫码';
  return `<div class="customer-top">
    <div class="mini-brand"><span class="mini-leaf"></span><div><b>山隐茶事</b><small>一席一茶 · 慢煮时光</small></div></div>
    <div class="customer-mode-switch">
      <button class="${mode === 'dine' ? 'active' : ''}" data-action="customer-mode" data-mode="dine">堂饮</button>
      <button class="${mode === 'takeaway' ? 'active' : ''}" data-action="customer-mode" data-mode="takeaway">打包</button>
    </div>
    <div class="customer-context"><span class="live-dot"></span><span>${esc(label)}</span>${table ? '<button class="rescan-btn" data-action="reset-scan">重新扫码</button>' : ''}</div>
  </div>`;
}

function renderScanLanding() {
  return `<div class="mobile-content scan-landing">
    <div class="scan-hero">
      <div class="steam-ornament">⌁</div>
      <span class="eyebrow">SCAN TO SEAT</span>
      <h1>扫描桌牌，开始点茶</h1>
      <p>此原型使用桌号卡片模拟微信扫码。选择一张桌子后，同桌订单会自动汇入同一桌单。</p>
    </div>
    <div class="table-grid-mini">
      ${store.state.tables.map((t, idx) => `<button class="scan-table-card ${idx === 0 ? 'featured' : ''}" data-action="scan-table" data-table-id="${t.id}"><span>桌位</span><b>${t.id}</b><small>${t.capacity} 人席</small></button>`).join('')}
    </div>
    <button class="package-entry" data-action="customer-mode" data-mode="takeaway"><span><b>不堂饮，直接打包</b><small>打包订单不关联桌号</small></span><i>→</i></button>
    <div class="prototype-note"><b>模拟说明</b><p>正式业务中桌号由桌面二维码识别；原型通过点击 T01–T08 模拟扫码结果。</p></div>
  </div>`;
}

function renderCustomerCatalog() {
  const customer = store.state.customer;
  const mode = customer.mode;
  const categories = ['全部', ...new Set(store.state.products.map((p) => p.category))];
  const products = store.state.products.filter((p) => p.active && (customer.category === '全部' || p.category === customer.category));
  const cart = customer.cart;
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => {
    const v = store.getVariant(line.productId, line.variantId);
    return sum + Number(v?.price || 0) * line.quantity;
  }, 0);
  return `<div class="mobile-content catalog-view">
    <div class="welcome-strip">
      <div><span class="eyebrow">TODAY'S TEA</span><h2>今日一盏，慢下来喝。</h2></div>
      <div class="welcome-stamp">${mode === 'dine' ? '堂饮加单' : '打包自取'}</div>
    </div>
    <div class="category-chips">${categories.map((cat) => `<button class="${customer.category === cat ? 'active' : ''}" data-action="category" data-category="${esc(cat)}">${esc(cat)}</button>`).join('')}</div>
    <div class="product-grid">
      ${products.map((product) => {
        const usable = store.productInStock(product, mode);
        const minPrice = Math.min(...product.variants.map((v) => v.price));
        return `<button class="product-card ${usable ? '' : 'sold-out'}" data-action="open-product" data-product-id="${product.id}" ${usable ? '' : 'disabled'}>
          ${productArt(product)}
          <div class="product-meta"><div class="product-title-row"><h3>${esc(product.name)}</h3><span>¥${minPrice}<small>起</small></span></div><p>${esc(product.subtitle)}</p><div class="product-foot"><span>${esc(product.variants.length)} 种规格</span><span>${usable ? '立即点单 →' : '原料不足'}</span></div></div>
        </button>`;
      }).join('')}
    </div>
    ${products.length === 0 ? emptyState('这个分类还没有茶', '可以切换其他分类继续浏览。') : ''}
  </div>
  ${cartCount ? `<div class="cart-dock"><button data-action="open-cart"><span class="cart-icon">袋</span><span class="cart-copy"><b>购物车 · ${cartCount} 件</b><small>${mode === 'dine' ? `堂饮 ${customer.currentTableId || ''}` : '打包外带'}</small></span><strong id="cart-dock-total">${money(cartTotal)}</strong><i>查看</i></button></div>` : ''}`;
}

function renderCustomerOrders() {
  const customer = store.state.customer;
  const session = customer.currentTableId ? store.getOpenSession(customer.currentTableId) : null;
  const current = session ? store.getSessionOrders(session.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
  const all = [...store.state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const orderCard = (o) => `<article class="customer-order-card">
    <div class="order-topline"><div><span class="eyebrow">${o.channel === 'dine' ? `${esc(o.tableId)} · 堂饮` : '打包外带'}</span><b>${esc(o.orderNo)}</b></div>${statusPill(o.status)}</div>
    <div class="order-items-mini">${o.items.map((item) => `<div><span>${esc(item.productName)} · ${esc(item.variantName)} × ${item.quantity}</span><b>${money(item.subtotal)}</b></div>`).join('')}</div>
    <div class="order-bottom"><small>${fmtTime(o.createdAt)} 下单 · ${o.items[0]?.options?.strength || ''} · ${o.items[0]?.options?.method || ''}</small><button data-action="open-order-detail" data-order-id="${o.id}">查看详情</button></div>
  </article>`;
  return `<div class="mobile-content customer-orders">
    <div class="orders-heading"><div><span class="eyebrow">MY ORDERS</span><h2>${session ? `${customer.currentTableId} 桌单` : '我的订单'}</h2><p>${session ? '同桌多笔订单会分别保留，连续加单不会覆盖前一笔。' : '这里查看当前订单和历史订单。'}</p></div><button class="soft-btn" data-action="continue-order">继续加单</button></div>
    <section><div class="section-label"><span>当前订单</span><small>${current.length} 笔</small></div>${current.length ? current.map(orderCard).join('') : emptyState('还没有当前订单', '扫描桌码点茶后，这里会显示制作进度。', '<button class="primary-btn small" data-action="continue-order">去点单</button>')}</section>
    <section><div class="section-label"><span>历史订单</span><small>全部电子记录</small></div>${all.length ? all.map(orderCard).join('') : emptyState('暂无历史', '使用原型下单后会保留在浏览器中。')}</section>
  </div>`;
}

function renderCustomerRail() {
  const customer = store.state.customer;
  const session = customer.currentTableId ? store.getOpenSession(customer.currentTableId) : null;
  const tableMoney = session ? store.getSessionMoney(session.id) : null;
  return `<aside class="demo-rail">
    <div class="rail-card">
      <span class="eyebrow">DEMO FLOW</span><h3>一条完整的经营链路</h3>
      <ol class="flow-list"><li><b>01</b><span>扫码入席<small>选择 T01–T08 模拟桌码</small></span></li><li><b>02</b><span>选择茶品与冲泡<small>规格、浓淡、方式、备注</small></span></li><li><b>03</b><span>店员接单制作<small>状态与库存联动</small></span></li><li><b>04</b><span>桌单结账<small>优惠、实收、未结</small></span></li><li><b>05</b><span>老板看经营<small>毛利、消耗、桌位贡献</small></span></li></ol>
    </div>
    <div class="rail-card current-table-card">
      <span class="eyebrow">CURRENT SESSION</span>
      ${session ? `<div class="rail-table-no">${esc(session.tableId)}</div><div class="rail-table-meta"><span>有效订单 <b>${tableMoney.orders.length}</b></span><span>桌单应收 <b>${money(tableMoney.amountDue)}</b></span><span>未结 <b>${money(tableMoney.unpaid)}</b></span></div><button class="text-btn" data-view="tables">打开桌单 →</button>` : `<p class="muted-copy">${customer.mode === 'takeaway' ? '当前为打包模式，不关联桌位。' : '选择桌位后，此区域会显示实时桌单。'}</p>`}
    </div>
    <div class="rail-note"><span>✳</span><p>这是经营模型验证原型，不连接微信、支付、打印机或真实后端。数据仅保存在当前浏览器。</p></div>
  </aside>`;
}

function renderCustomer() {
  const c = store.state.customer;
  let body;
  if (c.view === 'orders') body = renderCustomerOrders();
  else if (c.mode === 'dine' && !c.currentTableId) body = renderScanLanding();
  else body = renderCustomerCatalog();
  return `<section class="customer-view">
    <div class="customer-intro"><span class="eyebrow">CUSTOMER EXPERIENCE</span><h1>顾客点单端</h1><p>模拟手机端扫码点茶。每一次操作都会同步到店员、桌单、库存和经营分析。</p></div>
    <div class="customer-layout">
      <div class="phone-shell">
        <div class="phone-status"><span>9:41</span><span>山隐茶事 · 微信点单</span><span>● ● ●</span></div>
        <div class="phone-body">
          ${customerTop(c.mode)}
          <div class="customer-subnav"><button class="${c.view === 'catalog' ? 'active' : ''}" data-action="customer-tab" data-tab="catalog">点茶</button><button class="${c.view === 'orders' ? 'active' : ''}" data-action="customer-tab" data-tab="orders">订单</button></div>
          ${body}
        </div>
      </div>
      ${renderCustomerRail()}
    </div>
  </section>`;
}

function renderApp() {
  const s = store.state;
  document.getElementById('app').innerHTML = `${renderHeader()}<main class="app-main">${s.ui.view === 'customer' ? renderCustomer() : s.ui.view === 'workbench' ? renderWorkbench() : s.ui.view === 'tables' ? renderTables() : s.ui.view === 'inventory' ? renderInventory() : renderAnalytics()}</main><footer class="app-footer"><span>山隐茶事 · 单店现制茶饮经营原型</span><span>V1.0 / ${todayLabel()} / 数据保存在本机浏览器</span></footer>`;
  renderModal();
}

function renderWorkbench() {
  const orders = [...store.state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const filters = [
    ['active', '全部进行中'], ['pending', '待接单'], ['accepted', '待制作'], ['making', '制作中'], ['completed', '已完成'], ['cancelled', '已取消'], ['takeaway', '打包订单']
  ];
  let visible = orders;
  if (ui.workFilter === 'active') visible = orders.filter((o) => ['pending', 'accepted', 'making'].includes(o.status));
  else if (ui.workFilter === 'takeaway') visible = orders.filter((o) => o.channel === 'takeaway' && o.status !== 'cancelled');
  else visible = orders.filter((o) => o.status === ui.workFilter);
  const pending = orders.filter((o) => o.status === 'pending').length;
  const accepted = orders.filter((o) => o.status === 'accepted').length;
  const making = orders.filter((o) => o.status === 'making').length;
  const completeToday = orders.filter((o) => o.status === 'completed' && o.completedAt && localDateKey(o.completedAt) === localDateKey()).length;
  const actionMap = { pending: ['accepted', '接单'], accepted: ['making', '开始制作'], making: ['completed', '制作完成'] };
  return `<section class="view-section workbench-view">
    <div class="view-heading">
      <div><span class="eyebrow">STORE TABLET · OPERATIONS</span><h1>店员工作台</h1><p>平板优先布局。新订单进入待接单区，制作状态只允许向前流转，违规回退会在操作层拦截。</p></div>
      <div class="view-heading-actions"><div class="date-chip">${todayLabel()}</div><button class="soft-btn" data-view="tables">查看桌位与结账</button></div>
    </div>
    <div class="metric-grid compact-metrics">
      <div class="metric-card warm"><span>待接单</span><strong>${pending}</strong><small>需要优先响应的新订单</small></div>
      <div class="metric-card"><span>待制作</span><strong>${accepted}</strong><small>已经接单，等待出汤</small></div>
      <div class="metric-card green"><span>制作中</span><strong>${making}</strong><small>原料已转为实际消耗</small></div>
      <div class="metric-card"><span>今日完成</span><strong>${completeToday}</strong><small>包含堂饮与打包</small></div>
    </div>
    <div class="filter-bar">${filters.map(([id, label]) => {
      const count = id === 'active' ? orders.filter((o) => ['pending', 'accepted', 'making'].includes(o.status)).length : id === 'takeaway' ? orders.filter((o) => o.channel === 'takeaway' && o.status !== 'cancelled').length : orders.filter((o) => o.status === id).length;
      return `<button class="${ui.workFilter === id ? 'active' : ''}" data-action="work-filter" data-filter="${id}">${label}<span>${count}</span></button>`;
    }).join('')}</div>
    <div class="order-board">
      ${visible.map((order) => {
        const action = actionMap[order.status];
        const cash = order.channel === 'takeaway' ? takeawayPaymentSummary(order) : null;
        return `<article class="order-card status-${order.status}">
          <div class="order-card-accent"></div>
          <div class="order-card-head"><div class="order-location">${order.channel === 'takeaway' ? '<span class="takeaway-mark">袋</span><div><b>打包外带</b><small>独立订单</small></div>' : `<span class="table-mark">${esc(order.tableId)}</span><div><b>${esc(order.tableId)} 桌</b><small>桌单 ${esc(order.sessionId)}</small></div>`}</div>${statusPill(order.status)}</div>
          <div class="order-number-row"><span>${esc(order.orderNo)}</span><time>${fmtTime(order.createdAt)}</time></div>
          ${cash ? `<div class="takeaway-pay-line"><span>应收 ${money(cash.due)} · 净实收 ${money(cash.paid)}${cash.refunded ? ` · 已退 ${money(cash.refunded)}` : '' }</span><b class="${cash.unpaid ? 'text-warn' : 'text-good'}">${cash.unpaid ? `未结 ${money(cash.unpaid)}` : '已收清'}</b></div>` : ''}
          <div class="order-item-list">${order.items.map((item) => `<div class="order-item"><div class="item-qty">×${item.quantity}</div><div class="item-main"><b>${esc(item.productName)}</b><span>${esc(item.variantName)} · ${esc(item.options?.strength || '')}<em>${esc(item.options?.method || '')}</em></span>${item.options?.note ? `<small class="item-note">备注：${esc(item.options.note)}</small>` : ''}</div><strong>${money(item.subtotal)}</strong></div>`).join('')}</div>
          <div class="order-card-foot"><div><span class="muted-label">订单金额</span><b>${money(order.subtotal)}</b></div><div class="order-actions">${cash && (cash.grossPaid > 0 || cash.unpaid > 0) && order.status !== 'cancelled' ? `<button class="soft-btn small" data-action="open-takeaway-payment" data-order-id="${order.id}">${cash.unpaid > 0 ? '收款/退款' : '收款记录'}</button>` : ''}${action ? `<button class="primary-btn small" data-action="advance-order" data-order-id="${order.id}" data-next="${action[0]}">${action[1]}</button>` : `<button class="soft-btn small" data-action="open-order-detail" data-order-id="${order.id}">查看详情</button>`}${!['completed', 'cancelled'].includes(order.status) ? `<button class="ghost-btn danger small" data-action="open-cancel-order" data-order-id="${order.id}">取消</button>` : ''}</div></div>
          ${order.status === 'cancelled' && order.lossCost > 0 ? `<div class="loss-strip">制作后取消 · 材料损耗 ${money(order.lossCost)} 已单独记录</div>` : ''}
        </article>`;
      }).join('')}
    </div>
    ${visible.length === 0 ? emptyState('当前筛选为空', '可以切换到其他状态，或从顾客端模拟一笔新订单。', '<button class="primary-btn small" data-view="customer">去顾客端点单</button>') : ''}
    <div class="operation-note"><span class="note-icon">i</span><div><b>状态机约束</b><p>待接单 → 待制作 → 制作中 → 已完成。取消订单时，未制作的预占库存会释放；已制作订单的材料不会自动恢复，而是进入损耗记录。</p></div></div>
  </section>`;
}

function renderTables() {
  const tables = store.state.tables.map((table) => {
    const status = store.getTableStatus(table.id);
    const session = store.getOpenSession(table.id);
    const moneyData = session ? store.getSessionMoney(session.id) : null;
    const completedHistory = store.state.sessions.filter((s) => s.tableId === table.id && s.status === 'closed').length;
    return { table, status, session, moneyData, completedHistory };
  });
  const dining = tables.filter((t) => t.status === 'dining').length;
  const settling = tables.filter((t) => t.status === 'settling').length;
  const free = tables.filter((t) => t.status === 'free').length;
  return `<section class="view-section tables-view">
    <div class="view-heading"><div><span class="eyebrow">FLOOR & CHECKOUT</span><h1>桌位与结账</h1><p>桌单汇总同桌多笔订单。结账只记录应收、优惠、实收和未结，不验证真实资金到账。</p></div><div class="view-heading-actions"><span class="legend"><i class="dot free"></i>空闲</span><span class="legend"><i class="dot dining"></i>用餐中</span><span class="legend"><i class="dot settling"></i>待结账</span></div></div>
    <div class="table-summary-row"><div><span>空闲桌位</span><b>${free}</b></div><div><span>正在用餐</span><b>${dining}</b></div><div><span>待结账</span><b>${settling}</b></div><div><span>当前堂饮未结</span><b>${money(tables.reduce((sum, t) => sum + (t.moneyData?.unpaid || 0), 0))}</b></div></div>
    <div class="floor-grid">
      ${tables.map(({ table, status, session, moneyData, completedHistory }) => `<button class="table-card ${status}" data-action="open-table" data-table-id="${table.id}">
        <div class="table-card-top"><span class="table-status-label">${status === 'free' ? '空闲' : status === 'dining' ? '用餐中' : '待结账'}</span><span class="table-capacity">${table.capacity} 人席</span></div>
        <div class="table-visual"><div class="table-oval">${esc(table.id)}</div>${Array.from({ length: table.capacity }, (_, i) => `<i class="chair chair-${i + 1}"></i>`).join('')}</div>
        <div class="table-data"><div><span>桌单金额</span><b>${money(moneyData?.amountDue || 0)}</b></div><div><span>未结金额</span><b class="${moneyData?.unpaid ? 'text-warn' : ''}">${money(moneyData?.unpaid || 0)}</b></div><div><span>有效订单</span><b>${moneyData?.orders?.length || 0}</b></div></div>
        <div class="table-card-foot"><span>${status === 'free' ? `${completedHistory} 条历史桌单` : `开台 ${fmtTime(session.openedAt)}`}</span><span>${status === 'free' ? '查看历史 →' : '管理桌单 →'}</span></div>
      </button>`).join('')}
    </div>
    <div class="two-column-note"><div class="mini-info-card"><span class="mini-label">桌单与订单是两层模型</span><p>一张桌单可以包含多个顾客的多笔订单。订单完成后，桌单仍保持开启，直到完成结账。</p></div><div class="mini-info-card"><span class="mini-label">打包订单不进入桌单</span><p>打包订单独立保存，不关联桌号，也不会出现在桌位金额汇总中。</p></div></div>
  </section>`;
}

function materialStatus(material) {
  const available = Math.max(0, Number(material.stock) - Number(material.reserved));
  if (available <= 0) return { key: 'out', label: '缺货' };
  if (available <= Number(material.warning)) return { key: 'low', label: '库存预警' };
  return { key: 'ok', label: '库存正常' };
}

function renderInventory() {
  const tab = ui.inventoryTab || 'products';
  const materialValue = store.state.materials.reduce((sum, m) => sum + Number(m.stock) * Number(m.price), 0);
  const lowCount = store.state.materials.filter((m) => materialStatus(m).key !== 'ok').length;
  const recipeVariants = store.state.products.reduce((sum, p) => sum + p.variants.filter((v) => v.recipe.length).length, 0);
  return `<section class="view-section inventory-view">
    <div class="view-heading"><div><span class="eyebrow">PRODUCT · RECIPE · STOCK</span><h1>商品与库存</h1><p>售价、配方与原料成本分层管理。订单创建时保存快照，后续改价或改配方不会回写历史订单。</p></div><div class="view-heading-actions">${tab === 'products' ? '<button class="primary-btn" data-action="add-product">＋ 新增茶品</button>' : tab === 'materials' ? '<button class="primary-btn" data-action="add-material">＋ 新增原料</button>' : '<button class="soft-btn" data-view="analytics">查看经营分析</button>'}</div></div>
    <div class="metric-grid compact-metrics"><div class="metric-card green"><span>在售茶品</span><strong>${store.state.products.filter((p) => p.active).length}</strong><small>共 ${store.state.products.length} 个商品</small></div><div class="metric-card"><span>库存原料</span><strong>${store.state.materials.length}</strong><small>库存总值 ${money(materialValue)}</small></div><div class="metric-card warm"><span>库存预警</span><strong>${lowCount}</strong><small>低于或接近预警线</small></div><div class="metric-card"><span>已配置配方</span><strong>${recipeVariants}</strong><small>规格级配方独立配置</small></div></div>
    <div class="section-tabs"><button class="${tab === 'products' ? 'active' : ''}" data-action="inventory-tab" data-tab="products">茶品与配方</button><button class="${tab === 'materials' ? 'active' : ''}" data-action="inventory-tab" data-tab="materials">原材料库存</button><button class="${tab === 'ledger' ? 'active' : ''}" data-action="inventory-tab" data-tab="ledger">库存流水</button></div>
    ${tab === 'products' ? renderProductManagement() : tab === 'materials' ? renderMaterialManagement() : renderInventoryLedger()}
  </section>`;
}

function renderProductManagement() {
  return `<div class="panel-card table-panel">
    <div class="panel-head"><div><span class="eyebrow">MENU MASTER</span><h2>茶品与规格</h2></div><p>每个规格独立配置售价、冲泡方式和原材料配方。</p></div>
    <div class="data-table-wrap"><table class="data-table product-table"><thead><tr><th>茶品</th><th>分类</th><th>规格与售价</th><th>参考成本</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${store.state.products.map((product) => {
        const recipeReady = product.variants.every((v) => v.recipe.length > 0);
        const costs = product.variants.map((v) => store.recipeCost(v));
        return `<tr>
          <td><div class="table-product"><span class="mini-art theme-${esc(product.theme)}">${esc(product.name.slice(0, 1))}</span><div><b>${esc(product.name)}</b><small>${esc(product.subtitle)}</small></div></div></td>
          <td><span class="category-tag">${esc(product.category)}</span></td>
          <td><div class="variant-stack">${product.variants.map((v) => `<span>${esc(v.name)} · ${money(v.price)}</span>`).join('')}</div></td>
          <td><span class="${recipeReady ? '' : 'text-warn'}">${recipeReady ? `${money(Math.min(...costs))} 起` : '配方未完善'}</span></td>
          <td><button class="switch-button ${product.active ? 'on' : ''}" data-action="toggle-product" data-product-id="${product.id}"><i></i><span>${product.active ? '在售' : '下架'}</span></button></td>
          <td><div class="row-actions"><button data-action="edit-product" data-product-id="${product.id}">编辑</button><button data-action="open-recipe" data-product-id="${product.id}">配方</button></div></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
    <div class="table-footnote">点击“配方”可编辑每个规格的茶叶、茶杯与打包材料消耗；保存后只影响新订单。</div>
  </div>`;
}

function renderMaterialManagement() {
  return `<div class="panel-card table-panel">
    <div class="panel-head"><div><span class="eyebrow">RAW MATERIALS</span><h2>原材料库存</h2></div><p>可售库存 = 物理库存 − 已提交订单预占。单位在本原型中严格固定。</p></div>
    <div class="data-table-wrap"><table class="data-table materials-table"><thead><tr><th>原材料</th><th>物理库存</th><th>已预占</th><th>可用库存</th><th>预警线</th><th>采购单价</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${store.state.materials.map((m) => {
        const status = materialStatus(m);
        const available = Math.max(0, m.stock - m.reserved);
        return `<tr class="${status.key === 'out' ? 'row-out' : status.key === 'low' ? 'row-low' : ''}">
          <td><div class="material-name"><span class="material-dot"></span><div><b>${esc(m.name)}</b><small>${esc(m.unit)}</small></div></div></td>
          <td><b>${Number(m.stock).toLocaleString('zh-CN')} ${esc(m.unit)}</b></td>
          <td>${Number(m.reserved || 0).toLocaleString('zh-CN')} ${esc(m.unit)}</td>
          <td><b class="${status.key !== 'ok' ? 'text-warn' : ''}">${available.toLocaleString('zh-CN')} ${esc(m.unit)}</b></td>
          <td>${Number(m.warning).toLocaleString('zh-CN')} ${esc(m.unit)}</td>
          <td>${money(m.price)} / ${esc(m.unit)}</td>
          <td><span class="stock-status ${status.key}"><i></i>${status.label}</span></td>
          <td><div class="row-actions"><button data-action="stock-in" data-material-id="${m.id}">入库</button><button data-action="adjust-stock" data-material-id="${m.id}">调整</button><button data-action="edit-material" data-material-id="${m.id}">编辑</button><button data-action="material-history" data-material-id="${m.id}">流水</button></div></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
    <div class="table-footnote">库存低于预警线会直接影响商品可售判断。手动入库后，商品可售状态立即重新计算。</div>
  </div>`;
}

function renderInventoryLedger() {
  const transactions = store.state.inventoryTransactions.slice(0, 120);
  return `<div class="panel-card table-panel"><div class="panel-head"><div><span class="eyebrow">STOCK LEDGER</span><h2>库存变动流水</h2></div><p>每一笔预占、释放、消耗、损耗、入库和调整都有独立记录。</p></div>
    <div class="ledger-list">${transactions.map((tx) => {
      const material = store.getMaterial(tx.materialId);
      const delta = tx.quantity || 0;
      const reserved = tx.reservedDelta || 0;
      return `<div class="ledger-row"><div class="ledger-icon ${tx.type}">${tx.type === 'stock_in' ? '入' : tx.type === 'consumption' ? '耗' : tx.type === 'reserve' ? '占' : tx.type === 'release' ? '放' : tx.type === 'loss' ? '损' : '调'}</div><div class="ledger-main"><b>${TX_LABEL[tx.type] || tx.type} · ${esc(material?.name || tx.materialId)}</b><span>${esc(tx.note)}${tx.orderNo ? ` · ${esc(tx.orderNo)}` : ''}</span></div><div class="ledger-values">${delta ? `<b class="${delta > 0 ? 'text-good' : 'text-warn'}">${delta > 0 ? '+' : ''}${delta} ${esc(material?.unit || '')}</b>` : ''}${reserved ? `<span>预占 ${reserved > 0 ? '+' : ''}${reserved}</span>` : ''}${tx.lossQuantity ? `<span>损耗 ${tx.lossQuantity}</span>` : ''}<small>结余 ${tx.stockAfter} · ${fmtDateTime(tx.at)}</small></div></div>`;
    }).join('')}</div>
    ${transactions.length === 0 ? emptyState('暂无库存流水', '下单、制作或入库后会产生记录。') : ''}
  </div>`;
}

function getAnalytics() {
  const today = localDateKey();
  const completedToday = store.state.orders.filter((o) =>
    o.status === 'completed' && o.completedAt && localDateKey(o.completedAt) === today
  );
  const cancelledToday = store.state.orders.filter((o) =>
    o.status === 'cancelled' && o.cancelledAt && localDateKey(o.cancelledAt) === today
  );
  const orders = completedToday;
  const sales = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const salesOrderIds = new Set(orders.map((o) => o.id));
  const sessionIds = new Set(orders.filter((o) => o.sessionId).map((o) => o.sessionId));

  const settlementsForSales = store.state.settlements.filter((s) => s.sessionId && sessionIds.has(s.sessionId));
  const discount = settlementsForSales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const actualReceivable = Math.max(0, sales - discount);

  // Cash flow follows payment/refund event dates and is intentionally independent of completedAt.
  const activePayments = (store.state.payments || []).filter((p) => p.status === 'ACTIVE');
  const activePaymentIds = new Set(activePayments.map((p) => p.id));
  const paymentsToday = activePayments.filter((p) => p.receivedAt && localDateKey(p.receivedAt) === today);
  const refundsToday = (store.state.refunds || []).filter((r) =>
    r.status === 'ACTIVE' && activePaymentIds.has(r.paymentId) && r.refundedAt && localDateKey(r.refundedAt) === today
  );
  const settlementsToday = store.state.settlements.filter((s) =>
    s.updatedAt && localDateKey(s.updatedAt) === today
  );
  const refundTotal = refundsToday.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paid = settlementsToday.reduce((sum, s) => sum + Number(s.paid || 0), 0)
    + paymentsToday.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    - refundTotal;

  // Outstanding belongs to today's completed sales, using all valid payment/refund history for those orders.
  const salesPayments = activePayments.filter((p) =>
    (p.orderId && salesOrderIds.has(p.orderId)) || (p.sessionId && sessionIds.has(p.sessionId))
  );
  const salesPaymentIds = new Set(salesPayments.map((p) => p.id));
  const salesRefundTotal = (store.state.refunds || []).filter((r) =>
    r.status === 'ACTIVE' && salesPaymentIds.has(r.paymentId)
  ).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const salesCollected = settlementsForSales.reduce((sum, s) => sum + Number(s.paid || 0), 0)
    + salesPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    - salesRefundTotal;
  const unpaid = Math.max(0, actualReceivable - salesCollected);
  const lossOrders = cancelledToday.filter((o) => Number(o.lossCost) > 0);
  const loss = lossOrders.reduce((sum, o) => sum + Number(o.lossCost || 0), 0);

  const settlementDiscountBySession = new Map();
  for (const s of settlementsForSales) {
    if (s.sessionId) settlementDiscountBySession.set(s.sessionId, Number(s.discount || 0));
  }
  const sessionSales = new Map();
  for (const o of orders) {
    if (o.sessionId) sessionSales.set(o.sessionId, (sessionSales.get(o.sessionId) || 0) + o.subtotal);
  }

  const products = new Map();
  for (const order of orders) {
    const sessionDiscount = order.sessionId ? (settlementDiscountBySession.get(order.sessionId) || 0) : 0;
    const sessionTotal = order.sessionId ? (sessionSales.get(order.sessionId) || order.subtotal) : order.subtotal;
    const orderDiscount = sessionTotal ? sessionDiscount * (order.subtotal / sessionTotal) : 0;
    for (const item of order.items) {
      const current = products.get(item.productName) || { name: item.productName, qty: 0, sales: 0, discount: 0, cost: 0, gross: 0, rate: 0 };
      const itemDiscount = order.subtotal ? orderDiscount * (item.subtotal / order.subtotal) : 0;
      current.qty += item.quantity;
      current.sales += item.subtotal;
      current.discount += itemDiscount;
      current.cost += item.totalCost;
      products.set(item.productName, current);
    }
  }
  const productRows = [...products.values()].map((p) => {
    const net = Math.max(0, p.sales - p.discount);
    const gross = net - p.cost;
    return { ...p, net, gross, rate: net ? (gross / net) * 100 : 0 };
  });

  const consumption = new Map();
  for (const tx of store.state.inventoryTransactions.filter((t) => t.type === 'consumption' && localDateKey(t.at) === today)) {
    consumption.set(tx.materialId, (consumption.get(tx.materialId) || 0) + Math.abs(Number(tx.quantity || 0)));
  }
  const consumptionRows = [...consumption.entries()].map(([id, qty]) => ({ material: store.getMaterial(id), qty })).filter((x) => x.material).sort((a, b) => b.qty - a.qty);

  const tableRows = store.state.tables.map((table) => {
    const tableOrders = orders.filter((o) => o.tableId === table.id && o.channel === 'dine');
    const sessionIdsForTable = new Set(tableOrders.map((o) => o.sessionId));
    const settlementsForTable = settlementsForSales.filter((s) => s.sessionId && sessionIdsForTable.has(s.sessionId));
    const tableSales = tableOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const tableDiscount = settlementsForTable.reduce((sum, s) => sum + Number(s.discount || 0), 0);
    const tablePaid = settlementsForTable.reduce((sum, s) => sum + Number(s.paid || 0), 0);
    return { table, count: tableOrders.length, sales: tableSales, net: Math.max(0, tableSales - tableDiscount), paid: tablePaid };
  }).filter((t) => t.count > 0).sort((a, b) => b.net - a.net);

  const hourMap = new Map();
  for (const order of orders) {
    const hour = new Date(order.completedAt).getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + order.subtotal);
  }
  const hours = Array.from({ length: 11 }, (_, i) => i + 9);
  const recentStockChanges = [...store.state.inventoryTransactions].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4);
  return {
    recentStockChanges, today, orders, completedToday, cancelledToday, sales, discount, paid, unpaid, actualReceivable, refundTotal, loss, settlements: settlementsForSales,
    productRows, productRevenueRank: [...productRows].sort((a, b) => b.net - a.net), productGrossRank: [...productRows].sort((a, b) => b.gross - a.gross), productMarginRank: [...productRows].filter((p) => p.net > 0).sort((a, b) => b.rate - a.rate),
    consumptionRows, tableRows, dineCount: orders.filter((o) => o.channel === 'dine').length, takeawayCount: orders.filter((o) => o.channel === 'takeaway').length,
    hours: hours.map((hour) => ({ hour, value: hourMap.get(hour) || 0 }))
  };
}

function renderRankingList(a) {
  const metric = ui.rankingMetric || 'gross';
  const sorters = {
    gross: (x, y) => y.gross - x.gross,
    revenue: (x, y) => y.net - x.net,
    qty: (x, y) => y.qty - x.qty,
    margin: (x, y) => y.rate - x.rate
  };
  const values = {
    gross: (p) => money(p.gross), revenue: (p) => money(p.net), qty: (p) => `${p.qty} 份`, margin: (p) => `${p.rate.toFixed(1)}%`
  };
  const raw = { gross: (p) => p.gross, revenue: (p) => p.net, qty: (p) => p.qty, margin: (p) => p.rate };
  const rows = [...a.productRows].sort(sorters[metric]);
  const max = Math.max(1, ...rows.map(raw[metric]));
  return `<div class="rank-list">${rows.length ? rows.map((p, idx) => `<div class="rank-row"><span class="rank-no">${String(idx + 1).padStart(2, '0')}</span><div class="rank-main"><div><b>${esc(p.name)}</b><span>${p.qty} 份 · 销售额 ${money(p.net)}</span></div><div class="progress-track"><i style="width:${Math.max(4, metric === 'margin' ? Math.min(100, raw[metric](p)) : (raw[metric](p) / max) * 100)}%"></i></div></div><div class="rank-value"><b>${values[metric](p)}</b><small>${p.rate.toFixed(1)}% 毛利</small></div></div>`).join('') : emptyState('暂无商品销售', '完成订单后生成商品排行。')}</div>`;
}
function renderAnalytics() {
  const a = getAnalytics();
  const warnings = store.state.materials.map((m) => ({ m, s: materialStatus(m), available: Math.max(0, m.stock - m.reserved) })).filter((x) => x.s.key !== 'ok').sort((x, y) => (x.available / Math.max(1, x.m.warning)) - (y.available / Math.max(1, y.m.warning)));
  const maxHour = Math.max(1, ...a.hours.map((h) => h.value));
  const totalChannel = Math.max(1, a.dineCount + a.takeawayCount);
  const dinePct = Math.round((a.dineCount / totalChannel) * 100);
  const bestGross = a.productGrossRank[0] || { name: '暂无数据', gross: 0, rate: 0 };
  return `<section class="view-section analytics-view">
    <div class="view-heading"><div><span class="eyebrow">OWNER'S PULSE</span><h1>老板经营分析</h1><p>所有指标由当前订单、桌单结账、库存流水和订单成本快照实时计算。毛利仅指商品材料毛利。</p></div><div class="view-heading-actions"><div class="date-chip">${todayLabel()}</div><button class="soft-btn" data-view="inventory">查看库存明细</button></div></div>
    <div class="metric-grid analytics-metrics">
      <div class="metric-card"><span>今日完成订单</span><strong>${a.orders.length}</strong><small>按 completedAt 归属营业日 · 取消 ${a.cancelledToday.length} 笔</small></div>
      <div class="metric-card"><span>商品销售额</span><strong>${money(a.sales)}</strong><small>仅统计今日已完成且未取消订单</small></div>
      <div class="metric-card warm"><span>今日优惠</span><strong>${money(a.discount)}</strong><small>来自桌单结账记录</small></div>
      <div class="metric-card green"><span>实际应收</span><strong>${money(a.actualReceivable)}</strong><small>销售额 − 优惠金额</small></div>
      <div class="metric-card"><span>净实收</span><strong>${money(a.paid)}</strong><small>收款减退款${a.refundTotal ? ` · 已退 ${money(a.refundTotal)}` : '' }</small></div>
      <div class="metric-card ${a.unpaid > 0 ? 'warm' : ''}"><span>未结金额</span><strong>${money(a.unpaid)}</strong><small>${a.unpaid > 0 ? '仍有桌单或订单未结清' : '当前全部结清'}</small></div>
    </div>
    <div class="dashboard-grid">
      <div class="panel-card revenue-panel">
        <div class="panel-head"><div><span class="eyebrow">REVENUE RHYTHM</span><h2>今日销售完成节奏</h2></div><span class="panel-highlight">峰值 ${money(Math.max(...a.hours.map((h) => h.value)))}</span></div>
        <div class="revenue-hero"><div><span>实际应收</span><b>${money(a.actualReceivable)}</b><small>材料毛利预计 <strong>${money(a.productRows.reduce((sum, p) => sum + p.gross, 0))}</strong></small></div><div class="channel-donut" style="--dine:${dinePct}%"><div><b>${dinePct}%</b><span>堂饮占比</span></div></div></div>
        <div class="hour-chart">${a.hours.map((h) => `<div class="hour-column"><span class="bar" style="height:${Math.max(4, (h.value / maxHour) * 100)}%" data-value="${money(h.value)}"></span><small>${h.hour}:00</small></div>`).join('')}</div>
        <div class="chart-legend"><span><i class="legend-dine"></i>堂饮 ${a.dineCount} 笔</span><span><i class="legend-takeaway"></i>打包 ${a.takeawayCount} 笔</span><span><i class="legend-loss"></i>取消损耗 ${money(a.loss)}</span><span><i class="legend-refund"></i>退款 ${money(a.refundTotal)}</span></div>
      </div>
      <div class="panel-card ranking-panel">
        <div class="panel-head"><div><span class="eyebrow">PRODUCT RANKING</span><h2>商品多维排行</h2></div><button class="text-btn" data-view="inventory">管理配方 →</button></div>
        <div class="rank-switch">${[['gross','毛利额'],['revenue','销售额'],['qty','销量'],['margin','毛利率']].map(([key,label]) => `<button class="${(ui.rankingMetric || 'gross') === key ? 'active' : ''}" data-action="ranking-metric" data-metric="${key}">${label}</button>`).join('')}</div>
        ${renderRankingList(a)}
      </div>
      <div class="panel-card stock-alert-panel">
        <div class="panel-head"><div><span class="eyebrow">STOCK WATCH</span><h2>原材料预警</h2></div><span class="alert-count">${warnings.length}</span></div>
        ${warnings.length ? warnings.slice(0, 5).map(({ m, s, available }) => `<div class="stock-alert-row"><div class="stock-alert-name"><span class="material-dot"></span><div><b>${esc(m.name)}</b><small>${s.label}</small></div></div><div class="stock-progress"><i style="width:${Math.min(100, (available / Math.max(1, m.warning)) * 100)}%"></i></div><div class="stock-alert-value"><b>${available}</b><small>${esc(m.unit)}</small></div></div>`).join('') : `<div class="all-good"><span>✓</span><div><b>库存状态良好</b><p>当前没有原料低于预警线。</p></div></div>`}
        <div class="mini-stock-changes"><div class="mini-stock-title"><span>最近库存变化</span><small>流水摘要</small></div>${a.recentStockChanges.map((tx) => `<div class="mini-stock-row"><span>${esc(store.getMaterial(tx.materialId)?.name || '未知原料')}</span><b class="${(tx.quantity || 0) > 0 ? 'text-good' : (tx.quantity || 0) < 0 ? 'text-warn' : ''}">${TX_LABEL[tx.type] || tx.type}${tx.quantity ? ` ${tx.quantity > 0 ? '+' : ''}${tx.quantity}` : tx.reservedDelta ? ` 预占${tx.reservedDelta > 0 ? '+' : ''}${tx.reservedDelta}` : ''}</b></div>`).join('')}</div>
        <button class="full-soft-btn" data-action="inventory-tab" data-tab="materials">处理库存预警 →</button>
      </div>
      <div class="panel-card consumption-panel">
        <div class="panel-head"><div><span class="eyebrow">MATERIAL FLOW</span><h2>原料消耗排行</h2></div><span class="panel-highlight">今日</span></div>
        <div class="consumption-list">${a.consumptionRows.length ? a.consumptionRows.map((row) => {
          const max = Math.max(1, ...a.consumptionRows.map((x) => x.qty));
          return `<div class="consumption-row"><div><b>${esc(row.material.name)}</b><span>${row.qty} ${esc(row.material.unit)}</span></div><div class="progress-track"><i style="width:${Math.max(5, (row.qty / max) * 100)}%"></i></div></div>`;
        }).join('') : `<p class="muted-copy">完成制作后记录原料消耗。</p>`}</div>
      </div>
      <div class="panel-card table-contribution-panel">
        <div class="panel-head"><div><span class="eyebrow">TABLE CONTRIBUTION</span><h2>各桌完成销售</h2></div><span class="panel-highlight">按完成日</span></div>
        <div class="simple-table"><div class="simple-table-head"><span>桌位</span><span>订单</span><span>实际应收</span><span>已记实收</span></div>${a.tableRows.length ? a.tableRows.map((r) => `<div class="simple-table-row"><b>${esc(r.table.id)}</b><span>${r.count}</span><span>${money(r.net)}</span><span>${money(r.paid)}</span></div>`).join('') : `<div class="table-empty">今日暂无堂饮消费</div>`}</div>
      </div>
      <div class="panel-card insight-panel"><span class="eyebrow">TODAY'S SIGNAL</span><h2>${esc(bestGross.name)} 贡献了最高材料毛利</h2><p>预计材料毛利 <b>${money(bestGross.gross)}</b>，毛利率 <b>${bestGross.rate.toFixed(1)}%</b>。该数值不包含房租、人工与水电。</p><div class="insight-rule"></div><p class="muted-copy">取消但已制作订单的材料成本已计入损耗 <b>${money(a.loss)}</b>，未混入正常毛利。</p></div>
    </div>
    <div class="data-note"><span>数据口径</span><p>销售额只在订单进入 COMPLETED 后计入，并按 completedAt 所在营业日归属；商品排行、材料毛利、桌位和小时趋势统一使用该口径。已取消订单不计销售，损耗按取消事实单独统计。净实收按当日有效收款减退款独立计算，不受订单完成时间影响。</p></div>
  </section>`;
}

function modalShell(title, eyebrow, body, size = '') {
  return `<div class="modal-backdrop"><div class="modal-window ${size}" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div><button class="modal-close" data-action="close-modal" aria-label="关闭">×</button></div><div class="modal-body">${body}</div></div></div>`;
}

function renderModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  document.body.classList.toggle('modal-open', !!ui.modal);
  if (!ui.modal) { root.innerHTML = ''; return; }
  const type = ui.modal.type;
  if (type === 'product') root.innerHTML = renderProductModal();
  else if (type === 'cart') root.innerHTML = renderCartModal();
  else if (type === 'order-detail') root.innerHTML = renderOrderDetailModal(ui.modal.orderId);
  else if (type === 'takeaway-payment') root.innerHTML = renderTakeawayPaymentModal(ui.modal.orderId);
  else if (type === 'takeaway-refund') root.innerHTML = renderTakeawayRefundModal(ui.modal.paymentId);
  else if (type === 'table') root.innerHTML = renderTableModal(ui.modal.tableId);
  else if (type === 'cancel-order') root.innerHTML = renderCancelOrderModal(ui.modal.orderId);
  else if (type === 'product-form') root.innerHTML = renderProductFormModal();
  else if (type === 'material-form') root.innerHTML = renderMaterialFormModal();
  else if (type === 'stock-move') root.innerHTML = renderStockMoveModal();
  else if (type === 'material-history') root.innerHTML = renderMaterialHistoryModal();
  else if (type === 'recipe') root.innerHTML = renderRecipeModal();
  else if (type === 'reset') root.innerHTML = renderResetModal();
  else root.innerHTML = '';
}

function renderProductModal() {
  const detail = ui.detail;
  const product = detail ? store.getProduct(detail.productId) : null;
  if (!product) return '';
  const variant = product.variants.find((v) => v.id === detail.variantId) || product.variants[0];
  const canMake = store.canMakeVariant(variant, store.state.customer.mode, detail.quantity);
  const shortages = store.requirementAvailability(store.buildRequirements(variant, store.state.customer.mode, detail.quantity));
  const unitCost = store.recipeCost(variant);
  return modalShell(product.name, 'TEA DETAIL · MAKE IT YOURS', `<div class="product-detail-modal">
    <div class="detail-art-wrap">${productArt(product)}<div class="detail-art-copy"><span>${esc(product.category)}</span><p>${esc(product.description)}</p></div></div>
    <div class="detail-options">
      <div class="option-block"><div class="option-label"><span>规格</span><small>不同规格独立售价与配方</small></div><div class="choice-grid">${product.variants.map((v) => {
        const available = store.canMakeVariant(v, store.state.customer.mode, detail.quantity);
        return `<button class="choice-button ${v.id === variant.id ? 'active' : ''}" data-action="detail-variant" data-variant-id="${v.id}" ${available ? '' : 'data-unavailable="true'}><b>${esc(v.name)}</b><span>${money(v.price)}</span>${available ? '' : '<small>原料不足</small>'}</button>`;
      }).join('')}</div></div>
      <div class="option-block"><div class="option-label"><span>浓淡</span><small>影响冲泡建议，不改变示例售价</small></div><div class="segmented-choice">${['清淡', '适中', '浓郁'].map((x) => `<button class="${detail.strength === x ? 'active' : ''}" data-action="detail-option" data-key="strength" data-value="${x}">${x}</button>`).join('')}</div></div>
      <div class="option-block"><div class="option-label"><span>冲泡方式</span><small>当前商品可配置</small></div><div class="segmented-choice wrap">${variant.methods.map((x) => `<button class="${detail.method === x ? 'active' : ''}" data-action="detail-option" data-key="method" data-value="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
      <div class="option-block"><label class="option-label" for="tea-note"><span>其他要求</span><small>选填</small></label><textarea id="tea-note" class="text-area" data-action="detail-note" placeholder="例如：少坐杯、茶汤分两壶、加一只杯…">${esc(detail.note)}</textarea></div>
      <div class="quantity-row"><div><span>数量</span><div class="stepper"><button data-action="detail-qty" data-delta="-1">−</button><b>${detail.quantity}</b><button data-action="detail-qty" data-delta="1">＋</button></div></div><div class="detail-price"><small>预计材料成本 ${money(unitCost * detail.quantity)}</small><b>${money(variant.price * detail.quantity)}</b></div></div>
      ${shortages.length ? `<div class="shortage-box"><b>库存不足，暂时无法加入购物车</b>${shortages.map((s) => `<p>${esc(s.name)} 需要 ${s.needed}${esc(s.unit)}，当前可用 ${s.available}${esc(s.unit)}</p>`).join('')}</div>` : ''}
      <button class="primary-btn full detail-add" data-action="add-cart" data-product-id="${product.id}">${detail.editingLineId ? '保存修改' : '加入购物车'}</button>
      <p class="modal-fineprint">${store.state.customer.mode === 'takeaway' ? '当前为打包模式，库存校验将额外包含包装袋。' : `当前为 ${esc(store.state.customer.currentTableId)} 桌堂饮，提交后进入该桌桌单。`}</p>
    </div>
  </div>`, 'large');
}

function renderCartModal() {
  const cart = store.state.customer.cart;
  const total = cart.reduce((sum, line) => {
    const v = store.getVariant(line.productId, line.variantId);
    return sum + Number(v?.price || 0) * line.quantity;
  }, 0);
  return modalShell('确认点单', 'YOUR TEA ORDER', `<div class="cart-modal">
    <div class="cart-context"><div><span>${store.state.customer.mode === 'takeaway' ? '打包外带' : '堂饮'}</span><b>${store.state.customer.mode === 'takeaway' ? '不关联桌号' : `${esc(store.state.customer.currentTableId)} 桌`}</b></div><small>${store.state.customer.mode === 'takeaway' ? '实际收款后由店员手动登记' : '提交后进入同一桌单，可继续扫码加单'}</small></div>
    <div class="cart-lines">${cart.map((line) => {
      const p = store.getProduct(line.productId);
      const v = store.getVariant(line.productId, line.variantId);
      return `<div class="cart-line"><div class="cart-line-art">${productArt(p, true)}</div><div class="cart-line-main"><b>${esc(p.name)} · ${esc(v.name)}</b><span>${esc(line.strength)} · ${esc(line.method)}</span>${line.note ? `<small>${esc(line.note)}</small>` : ''}<div class="cart-line-controls"><div class="stepper small"><button data-action="cart-qty" data-line-id="${line.lineId}" data-delta="-1">−</button><b>${line.quantity}</b><button data-action="cart-qty" data-line-id="${line.lineId}" data-delta="1">＋</button></div><button class="text-btn" data-action="edit-cart-line" data-line-id="${line.lineId}">修改</button><button class="text-btn danger" data-action="remove-cart-line" data-line-id="${line.lineId}">删除</button></div></div><strong>${money(v.price * line.quantity)}</strong></div>`;
    }).join('')}</div>
    <div class="cart-total-line"><span>合计</span><b>${money(total)}</b></div>
    <div class="cart-actions"><button class="soft-btn" data-action="close-modal">继续挑选</button><button class="primary-btn" data-action="submit-order">提交 ${store.state.customer.mode === 'takeaway' ? '打包' : '堂饮'}订单</button></div>
    <p class="modal-fineprint">提交时会再次校验全部原材料可用库存；如果库存不足，订单不会生成。</p>
  </div>`);
}

function renderTakeawayPaymentModal(orderId) {
  const order = store.getOrder(orderId);
  if (!order || order.channel !== 'takeaway') return '';
  const cash = takeawayPaymentSummary(order);
  const payments = (store.state.payments || []).filter((p) => p.orderId === order.id && p.status === 'ACTIVE');
  return modalShell(`收款与退款 · ${order.orderNo}`, 'MANUAL CASH RECORD', `<div class="payment-records-panel">
    <div class="stock-current-card"><span>当前净实收</span><b>${money(cash.paid)}</b><small>订单应收 ${money(cash.due)} · 已退 ${money(cash.refunded)} · 未结 ${money(cash.unpaid)}</small></div>
    <div class="payment-record-list">${payments.length ? payments.map((p) => {
      const refunded = store.getPaymentRefunded(p.id);
      const refundable = Math.max(0, Number(p.amount) - refunded);
      return `<div class="payment-record-row"><div><b>${esc(p.paymentNo)}</b><span>${fmtDateTime(p.receivedAt)} · 收款 ${money(p.amount)} · 已退 ${money(refunded)}</span></div><button class="soft-btn small" data-action="open-takeaway-refund" data-payment-id="${p.id}" ${refundable <= 0 ? 'disabled' : ''}>${refundable > 0 ? '登记退款' : '已退完'}</button></div>`;
    }).join('') : '<p class="muted-copy">尚未登记收款。</p>'}</div>
    ${cash.unpaid > 0 && order.status !== 'cancelled' ? `<form class="compact-form payment-add-form" data-form="takeaway-payment" data-order-id="${order.id}">
      <div class="form-section-title"><div><b>新增实收</b><small>系统不验证真实资金到账</small></div></div>
      <label><span>本次实收金额</span><input class="text-input" name="amount" type="number" min="0.01" max="${cash.unpaid}" step="0.01" value="${cash.unpaid.toFixed(2)}" required></label>
      <label><span>收款备注</span><input class="text-input" name="note" placeholder="例如：现金收款、顾客已扫码给店员"></label>
      <div class="form-actions"><button type="button" class="soft-btn" data-action="close-modal">关闭</button><button type="submit" class="primary-btn">确认登记实收</button></div>
    </form>` : '<p class="modal-fineprint">该订单当前没有待登记实收。</p>'}
  </div>`);
}

function renderTakeawayRefundModal(paymentId) {
  const payment = (store.state.payments || []).find((p) => p.id === paymentId && p.status === 'ACTIVE');
  if (!payment) return '';
  const refunded = store.getPaymentRefunded(payment.id);
  const refundable = Math.max(0, Number(payment.amount) - refunded);
  const order = store.getOrder(payment.orderId);
  return modalShell(`登记退款 · ${payment.paymentNo}`, 'MANUAL REFUND RECORD', `<form class="compact-form" data-form="takeaway-refund" data-payment-id="${payment.id}">
    <div class="stock-current-card"><span>原收款剩余可退</span><b>${money(refundable)}</b><small>${order?.orderNo || ''} · 原收款 ${money(payment.amount)} · 已退 ${money(refunded)}</small></div>
    <label><span>本次退款金额</span><input class="text-input" name="amount" type="number" min="0.01" max="${refundable}" step="0.01" value="${refundable.toFixed(2)}" required></label>
    <label><span>退款原因</span><input class="text-input" name="reason" required placeholder="例如：顾客取消订单"></label>
    <div class="warning-box">退款必须关联原收款；累计退款不能超过原收款。原收款记录不会被修改或删除。</div>
    <div class="form-actions"><button type="button" class="soft-btn" data-action="back-payment-records" data-order-id="${order?.id || ''}">返回收款记录</button><button type="submit" class="danger-btn">确认登记退款</button></div>
  </form>`);
}
function renderOrderDetailModal(orderId) {
  const o = store.getOrder(orderId);
  if (!o) return '';
  const steps = ['pending', 'accepted', 'making', 'completed'];
  const currentIndex = steps.indexOf(o.status);
  return modalShell(`订单 ${o.orderNo}`, o.channel === 'takeaway' ? 'TAKEAWAY ORDER' : `TABLE ${o.tableId} · SESSION ${o.sessionId}`, `<div class="order-detail-modal">
    <div class="detail-status-banner ${o.status}"><div>${statusPill(o.status)}<b>${o.channel === 'takeaway' ? '打包外带' : `${esc(o.tableId)} 桌堂饮`}</b></div><time>${fmtDateTime(o.createdAt)}</time></div>
    <div class="timeline">${steps.map((step, idx) => `<div class="timeline-step ${o.status === 'cancelled' ? 'cancelled' : idx <= currentIndex ? 'done' : ''}"><i>${idx < currentIndex ? '✓' : idx + 1}</i><span>${STATUS_LABEL[step]}</span></div>`).join('')}</div>
    ${o.status === 'cancelled' ? `<div class="cancel-banner"><b>订单已取消</b><p>${esc(o.cancellationReason || '未填写取消原因')}${o.lossCost > 0 ? ` · 已制作材料损耗 ${money(o.lossCost)}` : ' · 预占库存已释放'}</p></div>` : ''}
    <div class="detail-items">${o.items.map((item) => `<div class="detail-item"><div class="detail-item-main"><div class="item-qty">×${item.quantity}</div><div><b>${esc(item.productName)}</b><span>${esc(item.variantName)} · ${esc(item.options?.strength)} · ${esc(item.options?.method)}</span>${item.options?.note ? `<small>备注：${esc(item.options.note)}</small>` : ''}</div></div><div class="detail-item-price"><b>${money(item.subtotal)}</b><small>成本 ${money(item.totalCost)}</small></div></div>`).join('')}</div>
    <div class="snapshot-box"><div class="snapshot-head"><b>订单成本快照</b><span>创建后不随商品或原料改价</span></div>${o.items.flatMap((i) => [...i.materials, ...i.packaging]).map((m) => `<div class="snapshot-row"><span>${esc(m.name)}</span><span>${m.qty} ${esc(m.unit)} × ${money(m.unitPrice)}</span><b>${money(m.qty * m.unitPrice)}</b></div>`).join('')}<div class="snapshot-total"><span>预计材料成本</span><b>${money(o.totalCost)}</b></div></div>
    ${o.channel === 'takeaway' ? `<div class="takeaway-cash-box"><span>打包实收登记</span><b>${money(takeawayPaymentSummary(o).paid)} / ${money(o.subtotal)}</b><small>${takeawayPaymentSummary(o).unpaid ? `未结 ${money(takeawayPaymentSummary(o).unpaid)}` : '已收清'} · 仅记录店员确认收到的现金</small></div>` : ''}
    <div class="detail-total"><span>订单金额</span><b>${money(o.subtotal)}</b></div>
  </div>`, 'medium');
}

function renderTableModal(tableId) {
  const table = store.state.tables.find((t) => t.id === tableId);
  if (!table) return '';
  const session = store.getOpenSession(tableId);
  const histories = store.state.sessions.filter((s) => s.tableId === tableId && s.status === 'closed').sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  if (!session) {
    return modalShell(`${tableId} 桌 · 空闲`, 'TABLE AVAILABLE', `<div class="table-modal">
      <div class="vacant-hero"><div class="table-oval large">${esc(tableId)}</div><span>${table.capacity} 人席 · 可接待新客</span><button class="soft-btn" data-action="go-scan-table" data-table-id="${table.id}">模拟顾客扫码入席 →</button></div>
      <div class="history-section"><div class="section-label"><span>历史桌单</span><small>${histories.length} 条</small></div>${histories.length ? histories.slice(0, 6).map((s) => {
        const m = store.getSessionMoney(s.id);
        return `<div class="history-row"><div><b>${esc(s.id)}</b><span>${fmtDateTime(s.openedAt)} — ${fmtTime(s.closedAt)}</span></div><div><span>${m.orders.length} 笔订单</span><b>${money(m.amountDue)}</b></div></div>`;
      }).join('') : '<p class="muted-copy">暂无已关闭的桌单。</p>'}</div>
    </div>`, 'medium');
  }
  const m = store.getSessionMoney(session.id);
  const unfinished = m.orders.some((o) => ['pending', 'accepted', 'making'].includes(o.status));
  const initialPaid = m.settlement?.paid || 0;
  const initialDiscount = m.settlement?.discount || 0;
  return modalShell(`${tableId} 桌单`, `TABLE SESSION · ${session.id}`, `<div class="table-modal open-session">
    <div class="session-summary"><div><span>开台时间</span><b>${fmtDateTime(session.openedAt)}</b></div><div><span>有效订单</span><b>${m.orders.length} 笔</b></div><div><span>应收金额</span><b>${money(m.subtotal)}</b></div><div><span>当前未结</span><b class="${m.unpaid ? 'text-warn' : 'text-good'}">${money(m.unpaid)}</b></div></div>
    <div class="session-orders">${m.orders.map((o) => `<div class="session-order-row"><div class="session-order-main"><span class="order-dot ${o.status}"></span><div><b>${esc(o.orderNo)} · ${money(o.subtotal)}</b><small>${o.items.map((i) => `${i.productName} ${i.variantName}×${i.quantity}`).join('，')}</small></div></div><div>${statusPill(o.status)}<button class="text-btn" data-action="open-order-detail" data-order-id="${o.id}">详情</button></div></div>`).join('') || '<p class="muted-copy">桌单暂无有效订单。</p>'}</div>
    ${unfinished ? `<div class="blocking-warning"><b>存在未完成订单，暂时不能关闭桌单</b><p>请先在店员工作台完成或取消订单，再返回结账。</p></div>` : ''}
    <form class="settlement-form" data-form="settlement" data-session-id="${session.id}">
      <div class="settlement-heading"><div><span class="eyebrow">CHECKOUT RECORD</span><h3>结账记账</h3></div><span>仅记录，不处理真实收款</span></div>
      <div class="money-input-grid"><label><span>优惠金额</span><div class="money-input"><i>¥</i><input name="discount" type="number" min="0" max="${m.subtotal}" step="0.01" value="${initialDiscount}" ${unfinished ? 'disabled' : ''}></div></label><label><span>实收金额</span><div class="money-input"><i>¥</i><input name="paid" type="number" min="0" max="${Math.max(0, m.subtotal - initialDiscount)}" step="0.01" value="${initialPaid}" ${unfinished ? 'disabled' : ''}></div></label></div>
      <div class="calculation-strip"><div><span>应收金额</span><b>${money(m.subtotal)}</b></div><div><span>优惠金额</span><b id="settlement-discount">${money(initialDiscount)}</b></div><div><span>实际应收</span><b id="settlement-due">${money(Math.max(0, m.subtotal - initialDiscount))}</b></div><div><span>未结金额</span><b id="settlement-unpaid">${money(Math.max(0, m.subtotal - initialDiscount - initialPaid))}</b></div></div>
      <div class="settlement-actions"><p>${unfinished ? '完成所有订单后才能保存结账并关闭桌单。' : m.unpaid === 0 ? '当前桌单已结清，可以关闭。' : '实收不足时只保存结账记录，桌单继续保持待结账。'}</p><button class="primary-btn" type="submit" ${unfinished ? 'disabled' : ''}>${m.unpaid === 0 && initialPaid >= Math.max(0, m.subtotal - initialDiscount) ? '确认结清并释放桌位' : '保存结账记录'}</button></div>
    </form>
    <div class="history-section compact"><div class="section-label"><span>该桌历史</span><small>${histories.length} 条</small></div>${histories.slice(0, 4).map((s) => { const x = store.getSessionMoney(s.id); return `<div class="history-row"><div><b>${esc(s.id)}</b><span>${fmtDateTime(s.closedAt)}</span></div><div><span>${x.orders.length} 笔</span><b>${money(x.amountDue)}</b></div></div>`; }).join('') || '<p class="muted-copy">暂无更早记录。</p>'}</div>
  </div>`, 'large');
}

function renderCancelOrderModal(orderId) {
  const o = store.getOrder(orderId);
  if (!o) return '';
  return modalShell('取消订单', 'CANCEL ORDER', `<form class="compact-form" data-form="cancel-order" data-order-id="${o.id}"><div class="confirm-order-box"><div><b>${esc(o.orderNo)}</b><span>${o.channel === 'takeaway' ? '打包外带' : `${esc(o.tableId)} 桌`} · ${money(o.subtotal)}</span></div>${statusPill(o.status)}</div><label><span>取消原因</span><input class="text-input" name="reason" required placeholder="例如：顾客临时离店"></label><div class="warning-box">${o.status === 'making' ? `订单已经开始制作。取消后不会恢复已消耗库存，预计 ${money(o.totalCost)} 材料成本将进入损耗记录。` : '订单尚未制作。取消后会释放本单预占的原材料库存。'}</div><div class="form-actions"><button type="button" class="soft-btn" data-action="close-modal">保留订单</button><button type="submit" class="danger-btn">确认取消</button></div></form>`);
}

function variantRow(v = {}) {
  return `<div class="variant-row" data-variant-id="${esc(v.id || '')}"><input class="variant-name" placeholder="规格名，如：单人份" value="${esc(v.name || '')}"><input class="variant-price" type="number" min="0" step="0.01" placeholder="售价" value="${Number(v.price || 0)}"><input class="variant-methods" placeholder="冲泡方式，用逗号分隔" value="${esc((v.methods || []).join(','))}"><button type="button" class="row-remove" data-action="remove-variant-row" title="删除规格">×</button></div>`;
}

function renderProductFormModal() {
  const p = ui.productForm || { name: '', category: '', subtitle: '', description: '', theme: 'jade', active: true, variants: [{ name: '单人份', price: 0, methods: ['盖碗冲泡'], recipe: [], packageExtra: [{ materialId: 'm-bag', qty: 1 }] }] };
  return modalShell(p.id ? `编辑 ${p.name}` : '新增茶品', 'PRODUCT EDITOR', `<form class="product-form compact-form" data-form="product" data-product-id="${esc(p.id || '')}"><div class="form-grid"><label><span>茶品名称</span><input class="text-input" name="name" required value="${esc(p.name)}"></label><label><span>分类</span><input class="text-input" name="category" list="category-list" required value="${esc(p.category)}"><datalist id="category-list">${[...new Set(store.state.products.map((x) => x.category))].map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label><label class="full-span"><span>一句话卖点</span><input class="text-input" name="subtitle" value="${esc(p.subtitle || '')}" placeholder="如：岩骨花香 · 醇厚回甘"></label><label class="full-span"><span>商品介绍</span><textarea class="text-area" name="description">${esc(p.description || '')}</textarea></label><label><span>视觉主题</span><select class="select-input" name="theme">${themes.map((x) => `<option value="${x}" ${p.theme === x ? 'selected' : ''}>${themeLabels[x]}</option>`).join('')}</select></label><label class="check-label"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><span>保存后在售</span></label></div><div class="form-section-title"><div><b>商品规格</b><small>售价与冲泡方式</small></div><button type="button" class="soft-btn small" data-action="add-variant-row">＋ 新增规格</button></div><div class="variant-row-labels"><span>规格名称</span><span>售价</span><span>冲泡方式</span><span></span></div><div class="variant-rows">${(p.variants || []).map((v) => variantRow(v)).join('')}</div><div class="form-actions"><button type="button" class="soft-btn" data-action="close-modal">取消</button><button type="submit" class="primary-btn">保存茶品</button></div></form>`, 'large');
}

function renderMaterialFormModal() {
  const m = ui.materialForm || { name: '', unit: '克', stock: 0, warning: 0, price: 0 };
  return modalShell(m.id ? `编辑 ${m.name}` : '新增原材料', 'MATERIAL EDITOR', `<form class="compact-form" data-form="material"><div class="form-grid"><label><span>原料名称</span><input class="text-input" name="name" required value="${esc(m.name)}"></label><label><span>单位</span><select class="select-input" name="unit">${['克', '个', '包', '毫升', '千克'].map((u) => `<option ${m.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>${!m.id ? `<label><span>初始库存</span><input class="text-input" name="stock" type="number" min="0" step="0.01" value="${m.stock || 0}"></label>` : ''}<label><span>预警库存</span><input class="text-input" name="warning" type="number" min="0" step="0.01" value="${m.warning || 0}"></label><label><span>采购单价（元/${esc(m.unit)}）</span><input class="text-input" name="price" type="number" min="0" step="0.01" value="${m.price || 0}"></label></div>${m.id ? '<div class="info-box">库存数量和成本变动请分别使用“入库”或“调整”，以便保留库存流水。修改采购单价只影响后续订单成本快照。</div>' : ''}<div class="form-actions"><button type="button" class="soft-btn" data-action="close-modal">取消</button><button type="submit" class="primary-btn">保存原料</button></div></form>`);
}

function renderStockMoveModal() {
  const move = ui.stockMove;
  const m = store.getMaterial(move.materialId);
  if (!m) return '';
  const isAdjust = move.type === 'adjust';
  return modalShell(isAdjust ? '库存调整' : '手动入库', m.name, `<form class="compact-form" data-form="stock-move" data-material-id="${m.id}" data-move-type="${move.type}"><div class="stock-current-card"><span>当前物理库存</span><b>${m.stock} ${esc(m.unit)}</b><small>已预占 ${m.reserved || 0} ${esc(m.unit)} · 可用 ${Math.max(0, m.stock - m.reserved)} ${esc(m.unit)}</small></div><label><span>${isAdjust ? '调整后库存' : '本次入库数量'}</span><input class="text-input" name="quantity" type="number" min="0" step="0.01" required value="${isAdjust ? m.stock : ''}" placeholder="请输入数量"></label><label><span>说明</span><input class="text-input" name="note" required placeholder="${isAdjust ? '如：月末盘点差异' : '如：供应商到货'}"></label><div class="form-actions"><button type="button" class="soft-btn" data-action="close-modal">取消</button><button type="submit" class="primary-btn">${isAdjust ? '确认调整' : '确认入库'}</button></div></form>`);
}

function renderMaterialHistoryModal() {
  const m = store.getMaterial(ui.historyMaterialId);
  if (!m) return '';
  const rows = store.state.inventoryTransactions.filter((t) => t.materialId === m.id).slice(0, 30);
  return modalShell(`${m.name} · 库存流水`, `${m.unit} · CURRENT ${m.stock}`, `<div class="history-modal"><div class="stock-current-card"><span>当前可用</span><b>${Math.max(0, m.stock - m.reserved)} ${esc(m.unit)}</b><small>物理库存 ${m.stock} · 已预占 ${m.reserved || 0}</small></div><div class="ledger-list modal-ledger">${rows.map((tx) => `<div class="ledger-row"><div class="ledger-icon ${tx.type}">${tx.type === 'stock_in' ? '入' : tx.type === 'consumption' ? '耗' : tx.type === 'reserve' ? '占' : tx.type === 'release' ? '放' : tx.type === 'loss' ? '损' : '调'}</div><div class="ledger-main"><b>${TX_LABEL[tx.type]}</b><span>${esc(tx.note)}${tx.orderNo ? ` · ${esc(tx.orderNo)}` : ''}</span></div><div class="ledger-values">${tx.quantity ? `<b>${tx.quantity > 0 ? '+' : ''}${tx.quantity}</b>` : ''}${tx.reservedDelta ? `<span>预占 ${tx.reservedDelta > 0 ? '+' : ''}${tx.reservedDelta}</span>` : ''}${tx.lossQuantity ? `<span>损耗 ${tx.lossQuantity}</span>` : ''}<small>${fmtDateTime(tx.at)}</small></div></div>`).join('') || '<p class="muted-copy">暂无流水。</p>'}</div></div>`, 'medium');
}

function recipeRow(kind, r = {}) {
  return `<div class="recipe-row" data-recipe-kind="${kind}"><select class="select-input recipe-material">${store.state.materials.map((m) => `<option value="${m.id}" ${m.id === r.materialId ? 'selected' : ''}>${esc(m.name)} · ${money(m.price)}/${esc(m.unit)}</option>`).join('')}</select><div class="recipe-qty"><input type="number" class="recipe-qty-input" min="0" step="0.01" value="${Number(r.qty || 0)}"><span class="recipe-unit">${esc(store.getMaterial(r.materialId)?.unit || '克')}</span></div><button type="button" class="row-remove" data-action="remove-recipe-row">×</button></div>`;
}

function renderRecipeModal() {
  const r = ui.recipe;
  const product = store.getProduct(r.productId);
  if (!product) return '';
  const variant = product.variants.find((v) => v.id === r.variantId) || product.variants[0];
  return modalShell(`${product.name} · 配方`, 'RECIPE BUILDER', `<form class="recipe-form" data-form="recipe" data-product-id="${product.id}"><div class="recipe-top"><label><span>选择规格</span><select class="select-input" data-action="recipe-variant">${product.variants.map((v) => `<option value="${v.id}" ${v.id === variant.id ? 'selected' : ''}>${esc(v.name)} · ${money(v.price)}</option>`).join('')}</select></label><div class="recipe-cost-card"><span>当前参考成本</span><b id="recipe-cost">${money(store.recipeCost(variant))}</b><small>售价 ${money(variant.price)} · 原料价实时读取</small></div></div><div class="recipe-columns"><div class="recipe-column"><div class="recipe-column-head"><div><b>堂饮基础配方</b><small>茶、杯及制作必需材料</small></div><button type="button" class="soft-btn small" data-action="add-recipe-row" data-kind="base">＋ 添加</button></div><div class="recipe-row-labels"><span>原材料</span><span>用量</span><span></span></div><div class="recipe-rows" data-recipe-list="base">${variant.recipe.map((x) => recipeRow('base', x)).join('')}</div></div><div class="recipe-column"><div class="recipe-column-head"><div><b>打包附加配方</b><small>仅打包订单额外计入</small></div><button type="button" class="soft-btn small" data-action="add-recipe-row" data-kind="package">＋ 添加</button></div><div class="recipe-row-labels"><span>原材料</span><span>用量</span><span></span></div><div class="recipe-rows" data-recipe-list="package">${variant.packageExtra.map((x) => recipeRow('package', x)).join('')}</div></div></div><div class="info-box">修改配方只影响之后创建的订单。历史订单保留下单时的材料、单价和成本快照。</div><div class="form-actions"><button type="button" class="soft-btn" data-action="close-modal">取消</button><button type="submit" class="primary-btn">保存配方</button></div></form>`, 'large');
}

function renderResetModal() {
  return modalShell('重置演示数据', 'RESET DEMO', `<div class="reset-modal"><div class="reset-mark">↺</div><h3>恢复到初始演示状态？</h3><p>所有新下的订单、桌单、结账、库存变动和商品修改都会被清除。该操作只影响当前浏览器里的模拟数据。</p><div class="form-actions"><button class="soft-btn" data-action="close-modal">取消</button><button class="danger-btn" data-action="reset-data">确认重置</button></div></div>`);
}

function closeModal() {
  ui.modal = null;
  renderApp();
}

function handleView(view) {
  if (!viewNames[view]) return;
  ui.modal = null;
  store.setView(view);
}

function shortageMessage(shortages) {
  return shortages?.length ? shortages.map((s) => `${s.name}缺 ${Math.max(0, s.needed - s.available)}${s.unit}`).join('；') : '库存不足';
}

function handleClick(event) {
  if (event.target.classList?.contains('modal-backdrop')) {
    closeModal();
    return;
  }
  const viewEl = event.target.closest('[data-view]');
  if (viewEl) {
    event.preventDefault();
    handleView(viewEl.dataset.view);
    return;
  }
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'close-modal') return closeModal();
  if (action === 'go-customer') return handleView('customer');
  if (action === 'confirm-reset') { ui.modal = { type: 'reset' }; return renderApp(); }
  if (action === 'reset-data') { store.reset(); ui.modal = null; ui.detail = null; renderApp(); notify('演示数据已恢复初始状态'); return; }
  if (action === 'customer-mode') { store.setCustomerMode(el.dataset.mode); return; }
  if (action === 'customer-tab') { store.setCustomerView(el.dataset.tab); return; }
  if (action === 'continue-order') { store.setCustomerView('catalog'); return; }
  if (action === 'edit-cart-line') {
    const line = store.state.customer.cart.find((x) => x.lineId === el.dataset.lineId);
    if (!line) return;
    ui.detail = { productId: line.productId, variantId: line.variantId, strength: line.strength, method: line.method, note: line.note, quantity: line.quantity, editingLineId: line.lineId };
    ui.modal = { type: 'product' };
    return renderApp();
  }
  if (action === 'reset-scan') { store.clearScan(); return; }
  if (action === 'scan-table') { store.scanTable(el.dataset.tableId); notify(`${el.dataset.tableId} 桌码识别成功`, 'success'); return; }
  if (action === 'category') { store.setCategory(el.dataset.category); return; }
  if (action === 'open-product') {
    const product = store.getProduct(el.dataset.productId);
    if (!product) return;
    const mode = store.state.customer.mode;
    const variant = product.variants.find((v) => store.canMakeVariant(v, mode, 1)) || product.variants[0];
    ui.detail = { productId: product.id, variantId: variant.id, strength: '适中', method: variant.methods[0], note: '', quantity: 1 };
    ui.modal = { type: 'product' };
    return renderApp();
  }
  if (action === 'detail-variant') {
    const variant = store.getVariant(ui.detail.productId, el.dataset.variantId);
    ui.detail.variantId = variant.id;
    if (!variant.methods.includes(ui.detail.method)) ui.detail.method = variant.methods[0];
    return renderApp();
  }
  if (action === 'detail-option') { ui.detail[el.dataset.key] = el.dataset.value; return renderApp(); }
  if (action === 'detail-qty') { ui.detail.quantity = Math.max(1, Math.min(20, ui.detail.quantity + Number(el.dataset.delta))); return renderApp(); }
  if (action === 'add-cart') {
    const wasEditing = !!ui.detail.editingLineId;
    const result = wasEditing ? store.updateCartLine(ui.detail.editingLineId, ui.detail) : store.addToCart(ui.detail);
    if (!result.ok) return notify(shortageMessage(result.shortages) || result.message, 'error');
    ui.modal = null;
    notify(wasEditing ? '购物车商品已更新' : '已加入购物车');
    return renderApp();
  }
  if (action === 'open-cart') { ui.modal = { type: 'cart' }; return renderApp(); }
  if (action === 'cart-qty') {
    const result = store.updateCartQuantity(el.dataset.lineId, Number(el.dataset.delta));
    if (result && !result.ok && result.shortages) notify(shortageMessage(result.shortages), 'error');
    return;
  }
  if (action === 'remove-cart-line') { store.removeCartLine(el.dataset.lineId); return; }
  if (action === 'submit-order') {
    const result = store.submitOrder();
    if (!result.ok) {
      const msg = result.shortages ? `无法提交：${shortageMessage(result.shortages)}` : result.message;
      return notify(msg, 'error');
    }
    ui.modal = null;
    ui.detail = null;
    notify(`订单 ${result.order.orderNo} 已提交，店员端已收到`, 'success');
    return renderApp();
  }
  if (action === 'open-order-detail') { ui.modal = { type: 'order-detail', orderId: el.dataset.orderId }; return renderApp(); }
  if (action === 'open-takeaway-payment') { ui.modal = { type: 'takeaway-payment', orderId: el.dataset.orderId }; return renderApp(); }
  if (action === 'open-takeaway-refund') { ui.modal = { type: 'takeaway-refund', paymentId: el.dataset.paymentId }; return renderApp(); }
  if (action === 'back-payment-records') { ui.modal = { type: 'takeaway-payment', orderId: el.dataset.orderId }; return renderApp(); }
  if (action === 'ranking-metric') { ui.rankingMetric = el.dataset.metric; return renderApp(); }
  if (action === 'work-filter') { ui.workFilter = el.dataset.filter; return renderApp(); }
  if (action === 'advance-order') {
    const result = store.transitionOrder(el.dataset.orderId, el.dataset.next);
    if (!result.ok) notify(result.message, 'error');
    else notify(`订单状态已更新为“${STATUS_LABEL[result.order.status]}”`, 'success');
    return;
  }
  if (action === 'open-cancel-order') { ui.modal = { type: 'cancel-order', orderId: el.dataset.orderId }; return renderApp(); }
  if (action === 'open-table') { ui.modal = { type: 'table', tableId: el.dataset.tableId }; return renderApp(); }
  if (action === 'go-scan-table') { ui.modal = null; store.scanTable(el.dataset.tableId); notify(`${el.dataset.tableId} 桌已进入点单`, 'success'); return; }
  if (action === 'inventory-tab') { ui.inventoryTab = el.dataset.tab; ui.modal = null; return renderApp(); }
  if (action === 'add-product') { ui.productForm = null; ui.modal = { type: 'product-form' }; return renderApp(); }
  if (action === 'edit-product') { const p = store.getProduct(el.dataset.productId); ui.productForm = JSON.parse(JSON.stringify(p)); ui.modal = { type: 'product-form' }; return renderApp(); }
  if (action === 'toggle-product') { const p = store.getProduct(el.dataset.productId); p.active = !p.active; store.save(); notify(`${p.name}已${p.active ? '上架' : '下架'}`); return; }
  if (action === 'open-recipe') {
    const p = store.getProduct(el.dataset.productId);
    ui.recipe = { productId: p.id, variantId: p.variants[0].id };
    ui.modal = { type: 'recipe' };
    return renderApp();
  }
  if (action === 'add-variant-row') { document.querySelector('.variant-rows')?.insertAdjacentHTML('beforeend', variantRow({ name: '', price: 0, methods: ['盖碗冲泡'] })); return; }
  if (action === 'remove-variant-row') {
    const rows = document.querySelectorAll('.variant-row');
    if (rows.length <= 1) return notify('至少保留一个规格', 'error');
    el.closest('.variant-row')?.remove();
    return;
  }
  if (action === 'add-material') { ui.materialForm = null; ui.modal = { type: 'material-form' }; return renderApp(); }
  if (action === 'edit-material') { ui.materialForm = JSON.parse(JSON.stringify(store.getMaterial(el.dataset.materialId))); ui.modal = { type: 'material-form' }; return renderApp(); }
  if (action === 'stock-in') { ui.stockMove = { materialId: el.dataset.materialId, type: 'stock-in' }; ui.modal = { type: 'stock-move' }; return renderApp(); }
  if (action === 'adjust-stock') { ui.stockMove = { materialId: el.dataset.materialId, type: 'adjust' }; ui.modal = { type: 'stock-move' }; return renderApp(); }
  if (action === 'material-history') { ui.historyMaterialId = el.dataset.materialId; ui.modal = { type: 'material-history' }; return renderApp(); }
  if (action === 'add-recipe-row') {
    const kind = el.dataset.kind;
    document.querySelector(`[data-recipe-list="${kind}"]`)?.insertAdjacentHTML('beforeend', recipeRow(kind, { materialId: store.state.materials[0]?.id, qty: 1 }));
    updateRecipeCost();
    return;
  }
  if (action === 'remove-recipe-row') { el.closest('.recipe-row')?.remove(); updateRecipeCost(); return; }
}

function updateRecipeCost() {
  if (!ui.recipe) return;
  const variant = store.getVariant(ui.recipe.productId, ui.recipe.variantId);
  if (!variant) return;
  let cost = 0;
  document.querySelectorAll('.recipe-row').forEach((row) => {
    const materialId = row.querySelector('.recipe-material')?.value;
    const qty = Number(row.querySelector('.recipe-qty-input')?.value || 0);
    const material = store.getMaterial(materialId);
    cost += qty * Number(material?.price || 0);
  });
  const target = document.getElementById('recipe-cost');
  if (target) target.textContent = money(cost);
}

function handleInput(event) {
  if (event.target.matches('[data-action="detail-note"]')) {
    ui.detail.note = event.target.value;
    return;
  }
  if (event.target.matches('.recipe-qty-input, .recipe-material')) {
    if (event.target.matches('.recipe-material')) {
      const row = event.target.closest('.recipe-row');
      const material = store.getMaterial(event.target.value);
      const unitEl = row?.querySelector('.recipe-unit');
      if (unitEl && material) unitEl.textContent = material.unit;
    }
    updateRecipeCost();
    return;
  }
  if (event.target.matches('.settlement-form input')) {
    const form = event.target.closest('.settlement-form');
    const sessionId = form?.dataset.sessionId;
    if (!sessionId) return;
    const m = store.getSessionMoney(sessionId);
    const discount = Math.min(m.subtotal, Math.max(0, Number(form.elements.discount.value || 0)));
    const amountDue = Math.max(0, m.subtotal - discount);
    const paid = Math.min(amountDue, Math.max(0, Number(form.elements.paid.value || 0)));
    const unpaid = Math.max(0, amountDue - paid);
    const d = document.getElementById('settlement-discount');
    const due = document.getElementById('settlement-due');
    const un = document.getElementById('settlement-unpaid');
    if (d) d.textContent = money(discount);
    if (due) due.textContent = money(amountDue);
    if (un) un.textContent = money(unpaid);
  }
}

function handleChange(event) {
  if (event.target.matches('[data-action="recipe-variant"]')) {
    ui.recipe.variantId = event.target.value;
    renderApp();
    return;
  }
  if (event.target.matches('.recipe-material')) {
    const row = event.target.closest('.recipe-row');
    const material = store.getMaterial(event.target.value);
    const unitEl = row?.querySelector('.recipe-unit');
    if (unitEl && material) unitEl.textContent = material.unit;
    updateRecipeCost();
  }
}

function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;

  if (type === 'product') {
    const existing = form.dataset.productId ? store.getProduct(form.dataset.productId) : null;
    const categories = form.elements.category.value.trim();
    if (!form.elements.name.value.trim() || !categories) return notify('请填写茶品名称和分类', 'error');
    const variants = [...form.querySelectorAll('.variant-row')].map((row, index) => {
      const id = row.dataset.variantId || '';
      const prior = existing?.variants.find((v) => v.id === id);
      return {
        id: id || `v-${Date.now()}-${index + 1}`,
        name: row.querySelector('.variant-name').value.trim() || `规格 ${index + 1}`,
        price: Math.max(0, Number(row.querySelector('.variant-price').value || 0)),
        methods: row.querySelector('.variant-methods').value.split(/[,，]/).map((x) => x.trim()).filter(Boolean).slice(0, 6).concat([]).length ? row.querySelector('.variant-methods').value.split(/[,，]/).map((x) => x.trim()).filter(Boolean).slice(0, 6) : ['标准冲泡'],
        recipe: prior?.recipe || [],
        packageExtra: prior?.packageExtra || [{ materialId: 'm-bag', qty: 1 }]
      };
    });
    const accentMap = { amber: '#8c522e', gold: '#a87c2d', jade: '#47735a', mint: '#4e7a63', cream: '#8d7d42', umber: '#78513f', sand: '#96785b', ruby: '#934d3f', forest: '#315c4a' };
    const result = store.saveProduct({
      id: form.dataset.productId || undefined,
      name: form.elements.name.value.trim(), category: categories,
      subtitle: form.elements.subtitle.value.trim(), description: form.elements.description.value.trim(),
      theme: form.elements.theme.value, accent: existing?.accent || accentMap[form.elements.theme.value],
      active: form.elements.active.checked, variants
    });
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = null; ui.productForm = null; notify('茶品已保存'); return renderApp();
  }

  if (type === 'material') {
    const result = store.saveMaterial({
      id: ui.materialForm?.id,
      name: form.elements.name.value.trim(), unit: form.elements.unit.value,
      stock: form.elements.stock ? Number(form.elements.stock.value) : 0,
      warning: Number(form.elements.warning.value), price: Number(form.elements.price.value)
    });
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = null; ui.materialForm = null; notify('原材料已保存'); return renderApp();
  }

  if (type === 'stock-move') {
    const qty = Number(form.elements.quantity.value);
    const note = form.elements.note.value.trim();
    const result = form.dataset.moveType === 'adjust' ? store.adjustStock(form.dataset.materialId, qty, note) : store.stockIn(form.dataset.materialId, qty, note);
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = null; notify(form.dataset.moveType === 'adjust' ? '库存已调整' : '入库完成，商品可售状态已刷新', 'success'); return renderApp();
  }

  if (type === 'takeaway-refund') {
    const result = store.recordRefund(form.dataset.paymentId, form.elements.amount.value, form.elements.reason.value.trim());
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = { type: 'takeaway-payment', orderId: store.state.payments.find((p) => p.id === form.dataset.paymentId)?.orderId };
    notify('退款已登记，原收款记录保持不变', 'success');
    return renderApp();
  }
  if (type === 'takeaway-payment') {
    const result = store.recordTakeawayPayment(form.dataset.orderId, form.elements.amount.value, form.elements.note.value.trim());
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = null;
    notify('打包订单实收已登记');
    return renderApp();
  }
  if (type === 'cancel-order') {
    const reason = form.elements.reason.value.trim();
    const result = store.transitionOrder(form.dataset.orderId, 'cancelled');
    if (!result.ok) return notify(result.message, 'error');
    result.order.cancellationReason = reason;
    store.save();
    ui.modal = null; notify('订单已取消，库存处理已记录', 'success'); return renderApp();
  }

  if (type === 'settlement') {
    const result = store.settleTable(form.dataset.sessionId, form.elements.discount.value, form.elements.paid.value);
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = null;
    notify(result.closed ? '桌单已结清，桌位恢复空闲' : '结账记录已保存，仍有未结金额', result.closed ? 'success' : 'default');
    return renderApp();
  }

  if (type === 'recipe') {
    const base = [...form.querySelectorAll('[data-recipe-list="base"] .recipe-row')].map((row) => ({ materialId: row.querySelector('.recipe-material').value, qty: Number(row.querySelector('.recipe-qty-input').value || 0) }));
    const pack = [...form.querySelectorAll('[data-recipe-list="package"] .recipe-row')].map((row) => ({ materialId: row.querySelector('.recipe-material').value, qty: Number(row.querySelector('.recipe-qty-input').value || 0) }));
    if (!base.length) return notify('至少配置一种基础原材料', 'error');
    const result = store.saveRecipe(form.dataset.productId, ui.recipe.variantId, base, pack);
    if (!result.ok) return notify(result.message, 'error');
    ui.modal = null; notify('配方已保存，新订单将使用最新配方', 'success'); return renderApp();
  }
}

document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);
document.addEventListener('submit', handleSubmit);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && ui.modal) closeModal(); });
store.subscribe(renderApp);
renderApp();
