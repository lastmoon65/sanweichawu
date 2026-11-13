from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
schema = (root / 'docs/architecture/v1.2/schema.prisma').read_text(encoding='utf-8')
sql = (root / 'docs/architecture/v1.2/constraints.sql').read_text(encoding='utf-8')
tx = (root / 'docs/architecture/v1.2/transactions.md').read_text(encoding='utf-8')
review = (root / 'docs/architecture/v1.2/review-report.md').read_text(encoding='utf-8')
store = (root / 'store.js').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')


def validate_mysql_script(text):
    """Structural validation for the hand-written MySQL trigger script.

    This is intentionally stricter than substring checks: it tracks DELIMITER
    state, extracts every CREATE TRIGGER boundary and verifies the terminator
    matches the trigger body (single statement vs BEGIN/END block). It does not
    replace executing the script on a real MySQL 8 server.
    """
    lines = text.splitlines()
    assert not re.search(r'(?m)^\s*END\$\$\$\s*$', text), 'END$$$ is not a valid terminator'

    delimiter = ';'
    block_lines = None
    delimiter_blocks = 0
    block_line_numbers = []

    for line_no, line in enumerate(lines, 1):
        stripped = line.strip()
        match = re.fullmatch(r'DELIMITER\s+(\S+)', stripped, re.I)
        if match:
            new_delimiter = match.group(1)
            if delimiter == ';' and new_delimiter == '$$':
                assert block_lines is None, f'nested DELIMITER block at line {line_no}'
                block_lines = []
                block_line_numbers = []
                delimiter = '$$'
            elif delimiter == '$$' and new_delimiter == ';':
                assert block_lines is not None, f'DELIMITER ; without opener at line {line_no}'
                delimiter_blocks += 1
                block_lines = None
                block_line_numbers = []
                delimiter = ';'
            else:
                raise AssertionError(f'unexpected DELIMITER change at line {line_no}: {stripped}')
            continue

        if block_lines is not None:
            block_lines.append(line)
            block_line_numbers.append(line_no)
        elif stripped.startswith('END$'):
            raise AssertionError(f'trigger terminator outside DELIMITER block at line {line_no}')

    assert block_lines is None and delimiter == ';', 'unclosed DELIMITER $$ block'

    trigger_starts = []
    trigger_names = []
    for index, line in enumerate(lines):
        match = re.match(r'^\s*CREATE\s+TRIGGER\s+`([^`]+)`', line, re.I)
        if match:
            trigger_starts.append(index)
            trigger_names.append(match.group(1))

    assert len(trigger_names) == len(set(trigger_names)), 'duplicate trigger name'

    for position, start in enumerate(trigger_starts):
        end = trigger_starts[position + 1] if position + 1 < len(trigger_starts) else len(lines)
        body = lines[start:end]
        significant = []
        for offset, line in enumerate(body):
            stripped = line.strip()
            if not stripped or stripped.startswith('--') or re.fullmatch(r'DELIMITER\s+\S+', stripped, re.I):
                continue
            significant.append((start + offset + 1, stripped))
        assert significant, f'empty trigger at line {start + 1}'

        has_block_body = any(stripped.upper() == 'BEGIN' for _, stripped in significant)
        if has_block_body:
            begin_lines = [line_no for line_no, stripped in significant if stripped.upper() == 'BEGIN']
            end_lines = [line_no for line_no, stripped in significant if stripped.startswith('END$')]
            assert len(begin_lines) == 1, f'trigger at line {start + 1} must contain one BEGIN'
            assert len(end_lines) == 1, f'trigger at line {start + 1} must contain one END$$ terminator'
            assert significant[-1][0] == end_lines[0], (
                f'trigger at line {start + 1} has content after END$$'
            )
            assert significant[-1][1] == 'END$$', (
                f'trigger at line {start + 1} must end exactly with END$$'
            )
            assert begin_lines[0] < end_lines[0], f'trigger at line {start + 1} has reversed BEGIN/END'
        else:
            assert significant[-1][1].rstrip().endswith(';'), (
                f'single-statement trigger at line {start + 1} must end with ;'
            )

    stray_end = [
        line_no for line_no, line in enumerate(lines, 1)
        if re.match(r'^\s*END\$', line) and 'END$$' not in line.strip()
    ]
    assert not stray_end, f'malformed END terminator at lines {stray_end}'

    return {
        'delimiter_blocks': delimiter_blocks,
        'triggers': len(trigger_names),
        'trigger_names': trigger_names,
    }


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

sql_structure = validate_mysql_script(sql)
for needle in [
    'trg_category_store_immutable_bu',
    'trg_product_store_immutable_bu',
    'trg_variant_product_immutable_bu',
    'trg_recipe_version_identity_bu',
    'trg_refund_record_limit_bi'
]:
    assert needle in sql_structure['trigger_names'], needle
print(
    'PASS: MySQL delimiter/trigger structure parsed '
    f"({sql_structure['delimiter_blocks']} delimiter blocks, {sql_structure['triggers']} triggers)"
)

# Negative self-tests prove the validator rejects the exact failure classes.
for label, corrupted, message in [
    ('triple-dollar terminator', sql.replace('END$$', 'END$$$', 1), 'END$$$'),
    ('unclosed delimiter block', sql.rsplit('DELIMITER ;', 1)[0], 'unclosed DELIMITER'),
    ('duplicate trigger', sql.replace('trg_session_store_bu', 'trg_session_store_bi', 1), 'duplicate trigger'),
]:
    try:
        validate_mysql_script(corrupted)
    except AssertionError as exc:
        assert message in str(exc), (label, str(exc))
    else:
        raise AssertionError(f'validator accepted corrupted SQL case: {label}')
print('PASS: SQL structural validator rejects malformed terminators, unclosed blocks and duplicate trigger names')

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

assert "localDateKey(o.completedAt) === today" in app
assert "localDateKey(o.cancelledAt) === today" in app
assert "localDateKey(p.receivedAt) === today" in app
assert "localDateKey(r.refundedAt) === today" in app
assert 'completedAt' in app and 'createdAt' not in re.search(r'function getAnalytics\(\).*?\n\}', app, re.S).group(0)
print('PASS: analytics source uses completion, cancellation and cash-event dates consistently')
