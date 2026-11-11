import assert from 'node:assert/strict';
import { assertStoreOwnership, StoreOwnershipError } from '../docs/architecture/v1.2/reference/store-ownership.mjs';

const rows = {
  diningTable: [
    { id: 1, storeId: 1 }, { id: 2, storeId: 2 }
  ],
  diningSession: [
    { id: 10, storeId: 1, tableId: 1 }, { id: 20, storeId: 2, tableId: 2 }
  ],
  order: [
    { id: 100, storeId: 1, tableId: 1, sessionId: 10 },
    { id: 200, storeId: 2, tableId: null, sessionId: null }
  ],
  category: [
    { id: 1000, storeId: 1 }, { id: 2000, storeId: 2 }
  ],
  product: [
    { id: 1100, storeId: 1, categoryId: 1000 },
    { id: 1200, storeId: 1, categoryId: 2000 },
    { id: 2100, storeId: 2, categoryId: 2000 }
  ],
  productVariant: [
    { id: 1110, productId: 1100, inventoryMode: 'MANAGED' },
    { id: 1120, productId: 1100, inventoryMode: 'MANAGED' },
    { id: 2110, productId: 2100, inventoryMode: 'MANAGED' }
  ],
  recipeVersion: [
    { id: 1111, variantId: 1110, status: 'ACTIVE' },
    { id: 1121, variantId: 1120, status: 'ACTIVE' },
    { id: 2111, variantId: 2110, status: 'ACTIVE' },
    { id: 1112, variantId: 1110, status: 'DRAFT' }
  ],
  orderItem: [
    { id: 101, orderId: 100, productId: 1100, variantId: 1110, recipeVersionId: 1111 },
    { id: 102, orderId: 100, productId: 1100, variantId: 1110, recipeVersionId: 1121 },
    { id: 103, orderId: 100, productId: 2100, variantId: 2110, recipeVersionId: 2111 }
  ],
  material: [
    { id: 3100, storeId: 1 }, { id: 3200, storeId: 2 }
  ],
  staff: [
    { id: 5100, storeId: 1 }, { id: 5200, storeId: 2 }
  ],
  paymentRecord: [
    { id: 4100, storeId: 1, orderId: 100, sessionId: null },
    { id: 4200, storeId: 1, orderId: null, sessionId: 10 },
    { id: 4300, storeId: 1, orderId: 200, sessionId: null },
    { id: 4400, storeId: 1, orderId: null, sessionId: null }
  ]
};

const tx = Object.fromEntries(Object.entries(rows).map(([name, list]) => [
  name,
  { findUnique: async ({ where }) => list.find((row) => String(row.id) === String(where.id)) || null }
]));

async function expectFailure(label, refs, fields) {
  const allowed = Array.isArray(fields) ? fields : [fields];
  await assert.rejects(
    () => assertStoreOwnership(tx, 1, refs),
    (error) => error instanceof StoreOwnershipError && allowed.includes(error.field),
    label
  );
  console.log(`PASS: ${label}`);
}

await assertStoreOwnership(tx, 1, {
  tableId: 1,
  sessionId: 10,
  orderId: 100,
  categoryId: 1000,
  productId: 1100,
  variantId: 1110,
  recipeVersionId: 1111,
  materialId: 3100,
  staffId: 5100,
  requireActiveRecipe: true
});
await assertStoreOwnership(tx, 1, { orderItemId: 101, orderId: 100, paymentId: 4100 });
console.log('PASS: valid same-store order, recipe, material and payment ownership');

await expectFailure('same-store Product cannot use another store Category', { categoryId: 1000, productId: 1200 }, 'categoryId');
await expectFailure('same-store Variant cannot use another variant RecipeVersion', {
  categoryId: 1000, productId: 1100, variantId: 1110, recipeVersionId: 1121, requireActiveRecipe: true
}, 'variantId');
await expectFailure('OrderItem cannot keep another variant RecipeVersion', {
  categoryId: 1000, productId: 1100, variantId: 1110, recipeVersionId: 1121, orderId: 100, orderItemId: 102
}, ['orderItem.recipeVersionId', 'variantId']);
await expectFailure('OrderItem cannot reference an item from another store', {
  orderId: 100, orderItemId: 103
}, ['orderItem.productId', 'productId.storeId']);
await expectFailure('DRAFT recipe cannot be used by an order', {
  categoryId: 1000, productId: 1100, variantId: 1110, recipeVersionId: 1112, requireActiveRecipe: true
}, 'recipeVersion.status');
await expectFailure('Payment cannot be attached to another order', {
  sessionId: 10, paymentId: 4100
}, ['payment.sessionId']);
await expectFailure('Payment target must be exactly one of session/order', {
  paymentId: 4400
}, 'payment.target');
await expectFailure('Operator Staff must belong to the authenticated store', {
  staffId: 5200
}, 'staffId.storeId');

console.log('All store ownership contract tests passed.');
