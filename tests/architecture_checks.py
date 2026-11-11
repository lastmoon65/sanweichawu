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



