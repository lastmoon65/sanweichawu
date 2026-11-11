const sameId = (left, right) => left != null && right != null && String(left) === String(right);

export class StoreOwnershipError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'StoreOwnershipError';
    this.code = 'STORE_OWNERSHIP_VIOLATION';
    this.field = field;
  }
}

function requireSame(actual, expected, field) {
  if (!sameId(actual, expected)) {
    throw new StoreOwnershipError(field, `${field} does not match its authorized parent`);
  }
}

async function loadOne(delegate, id, field) {
  if (id == null) return null;
  const row = await delegate.findUnique({ where: { id } });
  if (!row) throw new StoreOwnershipError(field, `${field} does not exist`);
  return row;
}

/**
 * Service-layer reference contract for V1.2. It mirrors the cross-store and
 * recipe-ownership triggers and is intended to be ported unchanged into the
 * NestJS transaction service before any write is committed.
 *
 * refs may contain:
 * tableId, sessionId, orderId, orderItemId, categoryId, productId, variantId,
 * recipeVersionId, materialId, paymentId, staffId, requireActiveRecipe.
 */
export async function assertStoreOwnership(tx, storeId, refs = {}) {
  if (storeId == null) throw new StoreOwnershipError('storeId', 'storeId is required');
  const loaded = {};

  const inStore = (row, field) => {
    requireSame(row.storeId, storeId, `${field}.storeId`);
    return row;
  };

  async function getCategory(id) {
    if (loaded.category) {
      requireSame(loaded.category.id, id, 'categoryId');
      return loaded.category;
    }
    loaded.category = inStore(await loadOne(tx.category, id, 'categoryId'), 'categoryId');
    return loaded.category;
  }

  async function getProduct(id) {
    if (loaded.product) {
      requireSame(loaded.product.id, id, 'productId');
      return loaded.product;
    }
    loaded.product = inStore(await loadOne(tx.product, id, 'productId'), 'productId');
    const category = await getCategory(loaded.product.categoryId);
    requireSame(loaded.product.categoryId, category.id, 'product.categoryId');
    return loaded.product;
  }

  async function getVariant(id) {
    if (loaded.variant) {
      requireSame(loaded.variant.id, id, 'variantId');
      return loaded.variant;
    }
    loaded.variant = await loadOne(tx.productVariant, id, 'variantId');
    const product = await getProduct(loaded.variant.productId);
    requireSame(loaded.variant.productId, product.id, 'variant.productId');
    return loaded.variant;
  }

  async function getRecipeVersion(id) {
    if (loaded.recipeVersion) {
      requireSame(loaded.recipeVersion.id, id, 'recipeVersionId');
      return loaded.recipeVersion;
    }
    loaded.recipeVersion = await loadOne(tx.recipeVersion, id, 'recipeVersionId');
    const variant = await getVariant(loaded.recipeVersion.variantId);
    requireSame(loaded.recipeVersion.variantId, variant.id, 'recipeVersion.variantId');
    if (refs.requireActiveRecipe) requireSame(loaded.recipeVersion.status, 'ACTIVE', 'recipeVersion.status');
    return loaded.recipeVersion;
  }

  async function getTable(id) {
    if (loaded.table) {
      requireSame(loaded.table.id, id, 'tableId');
      return loaded.table;
    }
    loaded.table = inStore(await loadOne(tx.diningTable, id, 'tableId'), 'tableId');
    return loaded.table;
  }

  async function getSession(id) {
    if (loaded.session) {
      requireSame(loaded.session.id, id, 'sessionId');
      return loaded.session;
    }
    loaded.session = inStore(await loadOne(tx.diningSession, id, 'sessionId'), 'sessionId');
    const table = await getTable(loaded.session.tableId);
    requireSame(loaded.session.tableId, table.id, 'session.tableId');
    return loaded.session;
  }

  async function getOrder(id) {
    if (loaded.order) {
      requireSame(loaded.order.id, id, 'orderId');
      return loaded.order;
    }
    loaded.order = inStore(await loadOne(tx.order, id, 'orderId'), 'orderId');
    if (loaded.order.sessionId != null) {
      const session = await getSession(loaded.order.sessionId);
      requireSame(loaded.order.sessionId, session.id, 'order.sessionId');
    }
    if (loaded.order.tableId != null) {
      const table = await getTable(loaded.order.tableId);
      requireSame(loaded.order.tableId, table.id, 'order.tableId');
    }
    return loaded.order;
  }

  if (refs.tableId != null) await getTable(refs.tableId);
  if (refs.sessionId != null) await getSession(refs.sessionId);
  if (refs.orderId != null) await getOrder(refs.orderId);
  if (refs.categoryId != null) await getCategory(refs.categoryId);
  if (refs.productId != null) await getProduct(refs.productId);
  if (refs.variantId != null) await getVariant(refs.variantId);
  if (refs.recipeVersionId != null) await getRecipeVersion(refs.recipeVersionId);

  if (refs.orderItemId != null) {
    loaded.orderItem = await loadOne(tx.orderItem, refs.orderItemId, 'orderItemId');
    if (refs.orderId != null) requireSame(loaded.orderItem.orderId, refs.orderId, 'orderItem.orderId');
    if (refs.productId != null) requireSame(loaded.orderItem.productId, refs.productId, 'orderItem.productId');
    if (refs.variantId != null) requireSame(loaded.orderItem.variantId, refs.variantId, 'orderItem.variantId');
    if (refs.recipeVersionId != null) requireSame(loaded.orderItem.recipeVersionId, refs.recipeVersionId, 'orderItem.recipeVersionId');

    const order = await getOrder(loaded.orderItem.orderId);
    requireSame(loaded.orderItem.orderId, order.id, 'orderItem.orderId');
    const product = await getProduct(loaded.orderItem.productId);
    requireSame(loaded.orderItem.productId, product.id, 'orderItem.productId');
    const variant = await getVariant(loaded.orderItem.variantId);
    requireSame(loaded.orderItem.variantId, variant.id, 'orderItem.variantId');
    requireSame(variant.productId, product.id, 'orderItem.variant.productId');

    if (loaded.orderItem.recipeVersionId != null) {
      const recipe = await getRecipeVersion(loaded.orderItem.recipeVersionId);
      requireSame(loaded.orderItem.recipeVersionId, recipe.id, 'orderItem.recipeVersionId');
      requireSame(recipe.variantId, variant.id, 'orderItem.recipeVersion.variantId');
    } else if (refs.recipeVersionId != null) {
      throw new StoreOwnershipError('orderItem.recipeVersionId', 'order item has no recipe version');
    }
  }

  if (refs.materialId != null) {
    loaded.material = inStore(await loadOne(tx.material, refs.materialId, 'materialId'), 'materialId');
  }

  if (refs.staffId != null) {
    loaded.staff = inStore(await loadOne(tx.staff, refs.staffId, 'staffId'), 'staffId');
  }

  if (refs.paymentId != null) {
    loaded.payment = inStore(await loadOne(tx.paymentRecord, refs.paymentId, 'paymentId'), 'paymentId');
    if ((loaded.payment.sessionId == null) === (loaded.payment.orderId == null)) {
      throw new StoreOwnershipError('payment.target', 'payment must reference exactly one session or order');
    }
    if (refs.sessionId != null) requireSame(loaded.payment.sessionId, refs.sessionId, 'payment.sessionId');
    if (refs.orderId != null) requireSame(loaded.payment.orderId, refs.orderId, 'payment.orderId');
    if (loaded.payment.sessionId != null) {
      const session = await getSession(loaded.payment.sessionId);
      requireSame(loaded.payment.sessionId, session.id, 'payment.sessionId');
    }
    if (loaded.payment.orderId != null) {
      const order = await getOrder(loaded.payment.orderId);
      requireSame(loaded.payment.orderId, order.id, 'payment.orderId');
    }
  }

  return loaded;
}
