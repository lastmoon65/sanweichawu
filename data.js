const STORAGE_KEY = 'tea-house-prototype-v1';
const SCHEMA_VERSION = 1;

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
    meta: { createdAt: new Date().toISOString(), lastOrderSeq: 1000, lastSessionSeq: 100, lastSettlementSeq: 100 },
    materials,
    products,
    tables: Array.from({ length: 8 }, (_, i) => ({ id: `T${String(i + 1).padStart(2, '0')}`, capacity: i % 3 === 0 ? 4 : 2 })),
    sessions: [], orders: [], settlements: [], inventoryTransactions: [],
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
  state.settlements.push({
    id: `SET${++state.meta.lastSettlementSeq}`, sessionId: null, orderId: takeawayId, tableId: null,
    amountDue: 25, discount: 0, paid: 25, unpaid: 0, status: 'closed',
    createdAt: takeawayAt, updatedAt: takeawayAt
  });

  return state;
}

export { STORAGE_KEY, SCHEMA_VERSION, createInitialState, clone, localDateKey, money, makeSnapshot };
