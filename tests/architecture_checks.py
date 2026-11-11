from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
schema = (root / 'docs/architecture/v1.2/schema.prisma').read_text(encoding='utf-8')
sql = (root / 'docs/architecture/v1.2/constraints.sql').read_text(encoding='utf-8')
tx = (root / 'docs/architecture/v1.2/transactions.md').read_text(encoding='utf-8')
review = (root / 'docs/architecture/v1.2/review-report.md').read_text(encoding='utf-8')
store = (root / 'store.js').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')

required_models = [
    'User', 'Staff', 'Store', 'Product', 'ProductVariant', 'RecipeVersion',
    'VariantRecipe', 'RecipeModifier', 'Material', 'StockMovement', 'LossRecord',
    'DiningTable', 'DiningSession', 'Order', 'OrderItem', 'OrderItemMaterial',
    'PaymentRecord', 'RefundRecord', 'DiscountAllocation', 'IdempotencyRecord', 'AuditLog'
]
models = set(re.findall(r'^model\s+(\w+)\s+\{', schema, re.M))
assert not (set(required_models) - models), set(required_models) - models
assert re.search(r'enum RecipeStatus \{\s*DRAFT\s+ACTIVE\s+ARCHIVED\s*\}', schema, re.S)
loss_block = re.search(r'model LossRecord \{(.*?)\n\}', schema, re.S).group(1)
assert '@@unique([orderItemId, materialId])' in loss_block
assert re.search(r'customerUserId\s+BigInt', schema)
assert '@@unique([storeId, endpoint, idempotencyKey])' in schema
print('PASS: required models, customer ownership, recipe states and loss uniqueness')

checks = {
    'payment XOR': 'chk_payment_target_xor',
    'order target': 'chk_order_target',
    'open session guard': 'uq_one_open_session_per_table',
    'active recipe guard': 'uq_one_active_recipe_per_variant',
    'refund limit trigger': 'trg_refund_record_limit_bi',
    'stock append-only': 'trg_stock_movement_no_update',
    'audit append-only': 'trg_audit_log_no_delete',
    'cross-store order': 'trg_order_store_bi',
    'cross-store payment': 'trg_payment_target_store_bi',
}
for label, needle in checks.items():
    assert needle in sql, (label, needle)
print('PASS: supplemental SQL core constraints present')

assert 'assert order.status != CANCELLED' in tx
assert 'aggregated_loss = GROUP BY orderItemId, materialId' in tx
assert 'publishRecipeVersion' in tx
assert '同 Key、PROCESSING' in tx
assert 'recordTakeawayPayment' in store
assert 'recordTakeawaySettlement' not in store
assert 'open-takeaway-payment' in app
assert 'takeaway-payment' in app
print('PASS: transaction rules and prototype manual-payment correction')

assert '已关闭桌单退款不重开桌单' in review
assert '先实际退款' in review
assert '固定材料调整直接相加' in review
assert '不要求订单先 COMPLETED' in review
print('PASS: confirmed business decisions reflected in review report')




for needle in [
    'trg_recipe_version_initial_draft_bi',
    'trg_recipe_version_status_bu',
    'trg_variant_recipe_immutable_bi',
    'trg_recipe_modifier_immutable_bi',
    'trg_product_category_store_bi',
    'trg_order_item_store_bi'
]:
    assert needle in sql, needle
assert re.search(r'status\s+RecipeStatus\s+@default\(DRAFT\)', schema)
assert 'recordRefund' in store
refund_test = (root / 'tests/refund_flow.py').read_text(encoding='utf-8')
assert 'partial refund' in refund_test and 'full refund' in refund_test
print('PASS: final P1 recipe, ownership and refund guards present')



# Structural validation for DELIMITER blocks and trigger identity.
start_count = len(re.findall(r'(?m)^DELIMITER \$\$\s*$', sql))
end_count = len(re.findall(r'(?m)^DELIMITER ;\s*$', sql))
assert start_count == end_count, (start_count, end_count)
trigger_names = re.findall(r'(?m)^CREATE TRIGGER `([^`]+)`', sql)
assert len(trigger_names) == len(set(trigger_names)), 'duplicate trigger name'
assert not re.search(r'(?m)^END\$\s*$', sql), 'corrupted END$ delimiter'
for needle in [
    'trg_category_store_immutable_bu',
    'trg_product_store_immutable_bu',
    'trg_variant_product_immutable_bu',
    'trg_recipe_version_identity_bu',
    'trg_refund_record_limit_bi'
]:
    assert needle in trigger_names, needle
print('PASS: SQL delimiter blocks and trigger names are structurally consistent')

reference = (root / 'docs/architecture/v1.2/reference/store-ownership.mjs').read_text(encoding='utf-8')
assert 'export async function assertStoreOwnership' in reference
for field in [
    'tableId', 'sessionId', 'orderId', 'orderItemId', 'categoryId', 'productId',
    'variantId', 'recipeVersionId', 'materialId', 'paymentId', 'staffId'
]:
    assert field in reference, field
for transaction_needle in [
    'startPreparation(storeId, orderId, request)',
    'adjustStock(storeId, materialId, physicalCount, reason, request)',
    'cancelAfterPreparation(storeId, orderId, request)',
    'recordPayment(storeId, targetType, targetId, amountFen, request)',
    'voidPayment(storeId, paymentId, reason, request)',
    'registerRefund(storeId, paymentId, amountFen, reason, request)',
    'changeDiscount(storeId, sessionId, newDiscountFen, reason, request)',
    'closeSession(storeId, sessionId, request)',
    'for each order in orders: assertStoreOwnership'
]:
    assert transaction_needle in tx, transaction_needle
print('PASS: executable ownership contract and transaction call sites are present')

ddl = (root / 'docs/architecture/v1.2/generated-mysql-ddl.sql').read_text(encoding='utf-8')
assert re.search(r"`status` ENUM\('DRAFT', 'ACTIVE', 'ARCHIVED'\) NOT NULL DEFAULT 'DRAFT'", ddl)
print('PASS: generated MySQL DDL defaults RecipeVersion to DRAFT')
