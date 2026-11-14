import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const expectedModels = [
  'Store',
  'User',
  'Staff',
  'Category',
  'Product',
  'ProductVariant',
  'VariantOptionGroup',
  'VariantOptionValue',
  'VariantRecipe',
  'RecipeModifier',
  'Material',
  'StockMovement',
  'LossRecord',
  'DiningTable',
  'DiningSession',
  'Order',
  'OrderItem',
  'OrderItemOption',
  'OrderItemMaterial',
  'PaymentRecord',
  'RefundRecord',
];

const blocks = new Map();
for (const match of schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)) {
  blocks.set(match[1], match[2]);
}

const actualModels = [...blocks.keys()];
assert(actualModels.length === 21, `Expected 21 models, found ${actualModels.length}`);
assert(
  JSON.stringify(actualModels.sort()) === JSON.stringify([...expectedModels].sort()),
  `Model set mismatch: ${actualModels.join(', ')}`,
);

for (const forbiddenModel of [
  'Merchant',
  'StaffCredential',
  'AuditLog',
  'RecipeVersion',
  'StoreOrderPolicy',
  'DiscountAllocation',
  'IdempotencyRecord',
]) {
  assert(!blocks.has(forbiddenModel), `Forbidden model present: ${forbiddenModel}`);
}

const forbiddenFields = {
  Store: ['merchantId'],
  Staff: ['userId'],
  ProductVariant: ['activeRecipeVersionId'],
  VariantRecipe: ['recipeVersionId'],
  RecipeModifier: ['recipeVersionId'],
  Order: ['tableId'],
  OrderItem: ['recipeVersionId', 'strengthSnapshot', 'brewingMethodSnapshot'],
};

for (const [model, fields] of Object.entries(forbiddenFields)) {
  const block = blocks.get(model);
  assert(block, `Missing model ${model}`);
  for (const field of fields) {
    assert(!new RegExp(`^\\s*${field}\\s`, 'm').test(block), `Forbidden field ${model}.${field}`);
  }
}

const requiredEnums = {
  StoreStatus: ['ACTIVE', 'SUSPENDED'],
  UserStatus: ['ACTIVE', 'DISABLED'],
  StaffRole: ['OWNER', 'MANAGER', 'STAFF'],
  StaffStatus: ['ACTIVE', 'DISABLED'],
  CommonStatus: ['ACTIVE', 'DISABLED'],
  InventoryMode: ['MANAGED', 'UNMANAGED'],
  RecipeMaterialRole: ['BASE', 'TAKEAWAY_EXTRA'],
  RecipeModifierTarget: ['BASE', 'TAKEAWAY_EXTRA'],
  OptionSelectionType: ['SINGLE', 'MULTI'],
  StockMovementType: ['OPENING_BALANCE', 'STOCK_IN', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST'],
  OrderItemMaterialSource: ['BASE', 'TAKEAWAY_EXTRA', 'MODIFIER'],
  OrderChannel: ['DINE', 'TAKEAWAY'],
  OrderStatus: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'COMPLETED', 'CANCELLED'],
  DiningSessionStatus: ['OPEN', 'CLOSED'],
  PaymentMethod: ['CASH', 'WECHAT', 'ALIPAY', 'POS', 'OTHER'],
  PaymentStatus: ['ACTIVE', 'VOIDED'],
  RefundStatus: ['ACTIVE', 'VOIDED'],
};

for (const [enumName, expectedValues] of Object.entries(requiredEnums)) {
  const match = schema.match(new RegExp(`^enum\\s+${enumName}\\s+\\{([\\s\\S]*?)^\\}`, 'm'));
  assert(match, `Missing enum ${enumName}`);
  const values = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert(
    JSON.stringify(values) === JSON.stringify(expectedValues),
    `Enum ${enumName} mismatch: ${values.join(', ')}`,
  );
}

const bigintFields = {
  ProductVariant: ['priceFen'],
  VariantOptionValue: ['priceDeltaFen'],
  Order: ['subtotalFen', 'discountFen', 'totalAmountFen'],
  OrderItem: ['unitPriceFen', 'lineSubtotalFen'],
  OrderItemOption: ['priceDeltaFenSnapshot'],
  PaymentRecord: ['amountFen'],
  RefundRecord: ['amountFen'],
};

const decimal3Fields = {
  VariantRecipe: ['quantity'],
  RecipeModifier: ['quantityDelta'],
  Material: ['onHand', 'reserved', 'warningThreshold'],
  StockMovement: ['quantityDelta', 'reservedDelta', 'onHandAfter', 'reservedAfter'],
  LossRecord: ['quantity'],
  OrderItemMaterial: ['quantityPerItem', 'totalQuantity'],
};

const decimal6Fields = {
  Material: ['averageCostPerUnit'],
  StockMovement: ['unitCostSnapshot', 'totalCostSnapshot'],
  LossRecord: ['unitCostSnapshot', 'lossCostSnapshot'],
  OrderItemMaterial: ['actualUnitCostSnapshot', 'actualTotalCostSnapshot'],
};

function assertFieldType(model, field, type, options = '') {
  const block = blocks.get(model);
  assert(block, `Missing model ${model}`);
  const pattern = new RegExp(`^\\s*${field}\\s+${type}\\??[^\\n]*${options}`, 'm');
  assert(pattern.test(block), `${model}.${field} must be ${type}${options}`);
}

for (const model of expectedModels) {
  assertFieldType(model, 'id', 'BigInt');
}

for (const [model, fields] of Object.entries(bigintFields)) {
  for (const field of fields) assertFieldType(model, field, 'BigInt');
}

for (const [model, fields] of Object.entries(decimal3Fields)) {
  for (const field of fields) assertFieldType(model, field, 'Decimal', '@db\\.Decimal\\(18, 3\\)');
}

for (const [model, fields] of Object.entries(decimal6Fields)) {
  for (const field of fields) assertFieldType(model, field, 'Decimal', '@db\\.Decimal\\(18, 6\\)');
}

assert(!/\b(Float|Double)\b/.test(schema), 'Float/Double is forbidden');
assert(!/\b\w*Fen\s+Int\b/.test(schema), 'Money fields must not use Int');
assert(!schema.includes('onDelete: Cascade'), 'Cascade deletion is forbidden');
assert(!schema.includes('onDelete: SetNull'), 'SetNull deletion is forbidden');

const requiredUnique = [
  '@unique([variantId, code])',
  '@unique([optionGroupId, code])',
  '@unique([variantId, materialId, role])',
  '@unique([variantId, optionValueId, materialId, targetRole])',
  '@unique([orderItemId, groupCodeSnapshot, valueCodeSnapshot])',
  '@unique([orderItemId, materialId, source])',
];
for (const unique of requiredUnique)
  assert(schema.includes(unique), `Missing unique constraint ${unique}`);

const requiredUniqueFields = {
  User: ['openid'],
  Order: ['orderNo', 'idempotencyKey'],
  StockMovement: ['movementNo', 'dedupeKey'],
  LossRecord: ['lossNo', 'dedupeKey', 'stockMovementId'],
  PaymentRecord: ['paymentNo', 'idempotencyKey'],
  RefundRecord: ['refundNo', 'idempotencyKey'],
};
for (const [model, fields] of Object.entries(requiredUniqueFields)) {
  const block = blocks.get(model);
  assert(block, `Missing model ${model}`);
  for (const field of fields) {
    assert(
      new RegExp(`^\\s*${field}\\s+[^\\n]+@unique\\b`, 'm').test(block),
      `Missing @unique on ${model}.${field}`,
    );
  }
}

const forbiddenUnique = ['@unique([storeId, code])', '@unique([orderItemId, materialId])'];
for (const unique of forbiddenUnique)
  assert(!schema.includes(unique), `Forbidden unique constraint ${unique}`);

const requiredRelationNullability = {
  'Order.sessionId': 'BigInt?',
  'LossRecord.orderId': 'BigInt?',
  'LossRecord.orderItemId': 'BigInt?',
  'LossRecord.stockMovementId': 'BigInt?',
  'PaymentRecord.sessionId': 'BigInt?',
  'PaymentRecord.orderId': 'BigInt?',
};
for (const [qualifiedName, type] of Object.entries(requiredRelationNullability)) {
  const [model, field] = qualifiedName.split('.');
  assertFieldType(model, field, type);
}

assertFieldType('Order', 'discountFen', 'BigInt', '@default\\(0\\)');
assertFieldType('DiningSession', 'discountFen', 'BigInt', '@default\\(0\\)');

const relationLines = schema.split(/\r?\n/).filter((line) => line.includes('@relation'));
for (const line of relationLines) {
  if (line.includes('fields:')) {
    assert(line.includes('onDelete: Restrict'), `Foreign key must use Restrict: ${line.trim()}`);
  }
}

assert(
  !existsSync(join(projectRoot, 'prisma', 'migrations')),
  'Migration files are forbidden in P1-02-A',
);

console.log(
  'PASS: schema contract (21 models, frozen fields/enums, BigInt/Decimal precision, unique keys, Restrict FKs)',
);
