from pathlib import Path
import json, math
from playwright.sync_api import sync_playwright, expect

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
KEY = 'tea-house-prototype-v1'

def state(page):
    return json.loads(page.evaluate("key => localStorage.getItem(key)", KEY))

def reset(page):
    page.get_by_role('button', name='重置演示数据').click()
    page.get_by_role('button', name='确认重置').click()
    page.wait_for_timeout(120)

def nav(page, view):
    page.locator(f'.nav-pill[data-view="{view}"]').click()
    page.wait_for_timeout(60)

def scan_and_add(page, table_id, product_name):
    rescan = page.locator('[data-action="reset-scan"]')
    if rescan.count():
        rescan.click()
    page.locator(f'[data-action="scan-table"][data-table-id="{table_id}"]').click()
    page.locator('.product-card').filter(has_text=product_name).click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
def order_card(page, order_no):
    return page.locator('.order-card').filter(has_text=order_no)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--allow-file-access-from-files'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    reset(page)

    # Inventory shortage blocks product, stock-in makes it available again.
    nav(page, 'inventory')
    page.locator('[data-action="inventory-tab"][data-tab="materials"]').click()
    page.locator('[data-action="adjust-stock"][data-material-id="m-dhp"]').click()
    page.locator('form[data-form="stock-move"] input[name="quantity"]').fill('0')
    page.locator('form[data-form="stock-move"] input[name="note"]').fill('模拟盘亏到零')
    page.locator('form[data-form="stock-move"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    nav(page, 'customer')
    page.locator('[data-action="scan-table"][data-table-id="T05"]').click()
    dhp_card = page.locator('.product-card').filter(has_text='大红袍')
    assert 'sold-out' in (dhp_card.get_attribute('class') or '') and dhp_card.is_disabled()
    print('PASS: shortage blocks DHP purchase')

    nav(page, 'inventory')
    page.locator('[data-action="inventory-tab"][data-tab="materials"]').click()
    page.locator('[data-action="stock-in"][data-material-id="m-dhp"]').click()
    page.locator('form[data-form="stock-move"] input[name="quantity"]').fill('100')
    page.locator('form[data-form="stock-move"] input[name="note"]').fill('补货入库')
    page.locator('form[data-form="stock-move"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    nav(page, 'customer')
    # current table T05 persists; refresh catalog and test enabled card.
    page.locator('[data-action="customer-tab"][data-tab="catalog"]').click()
    dhp_card = page.locator('.product-card').filter(has_text='大红袍')
    assert not dhp_card.is_disabled()
    print('PASS: stock-in restores availability')

    # Cancel before making releases reservation.
    scan_and_add(page, 'T02', '大红袍')
    s = state(page)
    order2 = next(o for o in s['orders'] if o.get('tableId') == 'T02' and o['status'] == 'pending')
    nav(page, 'workbench')
    card = order_card(page, order2['orderNo'])
    card.get_by_role('button', name='取消').click()
    page.locator('form[data-form="cancel-order"] input[name="reason"]').fill('顾客临时取消')
    page.locator('form[data-form="cancel-order"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert next(o for o in s['orders'] if o['id'] == order2['id'])['status'] == 'cancelled'
    assert any(tx['type'] == 'release' and tx.get('orderId') == order2['id'] for tx in s['inventoryTransactions'])
    print('PASS: cancel before making releases reserved stock')

    # Cancel after making records loss and does not restore stock.
    nav(page, 'customer')
    page.locator('[data-action="continue-order"]').click()
    page.locator('.product-card').filter(has_text='大红袍').click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    latest_t02 = [o for o in s['orders'] if o.get('tableId') == 'T02' and o['status'] == 'pending'][0]
    nav(page, 'workbench')
    card = order_card(page, latest_t02['orderNo'])
    card.get_by_role('button', name='接单').click()
    page.wait_for_timeout(50)
    order_card(page, latest_t02['orderNo']).get_by_role('button', name='开始制作').click()
    page.wait_for_timeout(50)
    order_card(page, latest_t02['orderNo']).get_by_role('button', name='取消').click()
    page.locator('form[data-form="cancel-order"] input[name="reason"]').fill('制作后发现口味错误')
    page.locator('form[data-form="cancel-order"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    canceled = next(o for o in s['orders'] if o['id'] == latest_t02['id'])
    assert canceled['status'] == 'cancelled' and canceled['lossCost'] > 0
    assert any(tx['type'] == 'loss' and tx.get('orderId') == canceled['id'] for tx in s['inventoryTransactions'])
    print('PASS: cancel after making records loss without stock restoration')

    # Create a price/cost snapshot before changes.
    nav(page, 'customer')
    page.locator('[data-action="continue-order"]').click()
    page.locator('.product-card').filter(has_text='大红袍').click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    old_order = [o for o in s['orders'] if o.get('tableId') == 'T02' and o['status'] == 'pending'][0]
    old_item = old_order['items'][0]
    old_snapshot = (old_item['unitPrice'], old_item['materials'][0]['qty'], old_item['materials'][0]['unitPrice'])

    # Change product price, recipe quantity, and raw material purchase price.
    nav(page, 'inventory')
    page.locator('[data-action="inventory-tab"][data-tab="products"]').click()
    page.locator('[data-action="edit-product"][data-product-id="p-dhp"]').click()
    form = page.locator('form[data-form="product"]')
    form.locator('.variant-row').first.locator('.variant-price').fill('40')
    form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    page.locator('[data-action="open-recipe"][data-product-id="p-dhp"]').click()
    recipe = page.locator('form[data-form="recipe"]')
    recipe.locator('[data-recipe-list="base"] .recipe-row').first.locator('.recipe-qty-input').fill('10')
    recipe.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    page.locator('[data-action="inventory-tab"][data-tab="materials"]').click()
    page.locator('[data-action="edit-material"][data-material-id="m-dhp"]').click()
    material_form = page.locator('form[data-form="material"]')
    material_form.locator('input[name="price"]').fill('0.60')
    material_form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    nav(page, 'customer')
    page.locator('[data-action="continue-order"]').click()
    page.locator('.product-card').filter(has_text='大红袍').click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    unchanged = next(o for o in s['orders'] if o['id'] == old_order['id'])['items'][0]
    assert (unchanged['unitPrice'], unchanged['materials'][0]['qty'], unchanged['materials'][0]['unitPrice']) == old_snapshot
    newest = max([o for o in s['orders'] if o.get('tableId') == 'T02'], key=lambda o: o['createdAt'])
    new_item = newest['items'][0]
    assert new_item['unitPrice'] == 40 and new_item['materials'][0]['qty'] == 10 and new_item['materials'][0]['unitPrice'] == 0.6
    print('PASS: historical price/recipe/cost snapshot remains unchanged; new order uses new values')

    # Prevent oversell: set DHP physical stock to current reserved + 8, then two attempts can only reserve one.
    s = state(page)
    dhp = next(m for m in s['materials'] if m['id'] == 'm-dhp')
    target = dhp['reserved'] + 10
    nav(page, 'inventory')
    page.locator('[data-action="inventory-tab"][data-tab="materials"]').click()
    page.locator('[data-action="adjust-stock"][data-material-id="m-dhp"]').click()
    page.locator('form[data-form="stock-move"] input[name="quantity"]').fill(str(target))
    page.locator('form[data-form="stock-move"] input[name="note"]').fill('并发测试边界库存')
    page.locator('form[data-form="stock-move"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    nav(page, 'customer')
    page.locator('[data-action="continue-order"]').click()
    page.locator('.product-card').filter(has_text='大红袍').click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    dhp = next(m for m in s['materials'] if m['id'] == 'm-dhp')
    assert dhp['stock'] - dhp['reserved'] < 10
    page.locator('[data-action="continue-order"]').click()
    # Product should now be unavailable rather than allow oversell.
    dhp_card = page.locator('.product-card').filter(has_text='大红袍')
    assert dhp_card.is_disabled()
    print('PASS: reservation prevents a second oversell attempt')

    # Analytics values derive from order data and should render six metrics and ranking rows.
    nav(page, 'analytics')
    expect(page.locator('.analytics-metrics .metric-card')).to_have_count(6)
    s = state(page)
    today = page.evaluate("() => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }")
    valid = [o for o in s['orders'] if o['status'] != 'cancelled' and page.evaluate("(iso) => { const d=new Date(iso); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }", o['createdAt']) == today]
    total_sales = sum(o['subtotal'] for o in valid)
    sales_text = page.locator('.analytics-metrics .metric-card').nth(1).locator('strong').inner_text()
    assert sales_text == f'¥{total_sales:.2f}', (sales_text, total_sales)
    print('PASS: analytics sales metric matches order data')

    # Responsive overflow checks.
    for width, height in [(1440, 1000), (1024, 900), (390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(100)
        overflow = page.evaluate('() => document.documentElement.scrollWidth - window.innerWidth')
        assert overflow <= 1, (width, overflow)
    print('PASS: no horizontal overflow at desktop/tablet/mobile widths')

    print('ERRORS:', errors)
    assert not errors, errors
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.screenshot(path='tests/screenshots/extended-analysis.png', full_page=True)
    browser.close()






