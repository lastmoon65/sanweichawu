import { STORAGE_KEY, SCHEMA_VERSION, createInitialState, clone, localDateKey, makeSnapshot } from './data.js';

const STATUS_LABEL = {
  pending: '待接单', accepted: '待制作', making: '制作中', completed: '已完成', cancelled: '已取消'
};
const TX_LABEL = {
  reserve: '库存预占', release: '释放预占', consumption: '制作消耗', loss: '取消损耗', stock_in: '手动入库', adjustment: '库存调整'
};

export class TeaStore {
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

export { STATUS_LABEL, TX_LABEL, localDateKey };
