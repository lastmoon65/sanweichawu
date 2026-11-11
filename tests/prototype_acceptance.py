from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
KEY = 'tea-house-prototype-v1'

def app_state(page):
    return json.loads(page.evaluate("key => localStorage.getItem(key)", KEY))

def reset(page):
    page.get_by_role('button', name='重置演示数据').click()
    page.get_by_role('button', name='确认重置').click()
    page.wait_for_timeout(150)

def choose_product(page, name):
    page.locator('.product-card').filter(has_text=name).click()
    expect(page.locator('.modal-window')).to_be_visible()

def add_visible_product(page):
    page.get_by_role('button', name='加入购物车').click()
    page.wait_for_timeout(100)

def submit_cart(page):
    page.locator('.cart-dock button').click()
    page.locator("[data-action='submit-order']").click()
    page.wait_for_timeout(120)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--allow-file-access-from-files'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.goto(URL, wait_until='networkidle')
    reset(page)

    # Customer: scan T01 and place DHP single with explicit options.
    page.locator('[data-action="scan-table"][data-table-id="T01"]').click()
    choose_product(page, '大红袍')
    page.locator('[data-action="detail-option"][data-key="strength"][data-value="浓郁"]').click()
    page.locator('[data-action="detail-option"][data-key="method"][data-value="盖碗冲泡"]').click()
    page.locator('#tea-note').fill('第二泡稍淡')
    add_visible_product(page)
    submit_cart(page)
    s = app_state(page)
    t01_orders = [o for o in s['orders'] if o.get('tableId') == 'T01' and o['status'] != 'cancelled']
    assert len(t01_orders) == 1, t01_orders
    first_order_id = t01_orders[0]['id']
    dhp = next(m for m in s['materials'] if m['id'] == 'm-dhp')
    assert dhp['reserved'] >= 8, dhp
    print('PASS: T01 first order submitted; DHP reserved', dhp['reserved'])

    # Continuous add-on.
    page.get_by_role('button', name='继续加单').click()
    choose_product(page, '铁观音')
    add_visible_product(page)
    submit_cart(page)
    s = app_state(page)
    t01_orders = [o for o in s['orders'] if o.get('tableId') == 'T01' and o['status'] != 'cancelled']
    assert len(t01_orders) == 2
    assert len({o['sessionId'] for o in t01_orders}) == 1
    print('PASS: T01 second order shares one table session')

    # Takeaway order.
    page.locator('.customer-mode-switch [data-mode="takeaway"]').click()
    page.locator('[data-action="customer-tab"][data-tab="catalog"]').click()
    choose_product(page, '茉莉花茶')
    add_visible_product(page)
    page.locator('.cart-dock button').click()
    page.locator("[data-action='submit-order']").click()
    page.wait_for_timeout(120)
    s = app_state(page)
    takeaway = next(o for o in s['orders'] if o['channel'] == 'takeaway' and o['status'] == 'pending')
    assert takeaway['tableId'] is None and takeaway['sessionId'] is None
    print('PASS: takeaway order independent from table session')

    # Workbench transitions both T01 orders through the complete state machine.
    page.locator('[data-view="workbench"]').click()
    for order in t01_orders:
        order_no = order['orderNo']
        card = page.locator('.order-card').filter(has_text=order_no)
        card.get_by_role('button', name='接单').click()
        page.wait_for_timeout(80)
        card = page.locator('.order-card').filter(has_text=order_no)
        card.get_by_role('button', name='开始制作').click()
        page.wait_for_timeout(80)
        card = page.locator('.order-card').filter(has_text=order_no)
        card.get_by_role('button', name='制作完成').click()
        page.wait_for_timeout(80)
    s = app_state(page)
    assert all(next(o for o in s['orders'] if o['id'] == order['id'])['status'] == 'completed' for order in t01_orders)
    order_nos = [o['orderNo'] for o in t01_orders]
    tx_types = {tx['type'] for tx in s['inventoryTransactions'] if tx.get('orderNo') in order_nos}
    assert {'reserve', 'consumption'}.issubset(tx_types), tx_types
    assert next(m for m in s['materials'] if m['id'] == 'm-dhp')['reserved'] == 0
    print('PASS: order state machine and stock conversion')

    # Table status and settlement.
    page.locator('.nav-pill[data-view="tables"]').click()
    page.locator('[data-action="open-table"][data-table-id="T01"]').click()
    expect(page.locator('.settlement-form')).to_be_visible()
    form = page.locator('.settlement-form')
    subtotal = float(page.evaluate("(id) => { const s=JSON.parse(localStorage.getItem('tea-house-prototype-v1')); return s.orders.filter(o=>o.sessionId===id&&o.status!=='cancelled').reduce((a,o)=>a+o.subtotal,0); }", t01_orders[0]['sessionId']))
    form.locator('input[name="discount"]').fill('5')
    form.locator('input[name="paid"]').fill(str(subtotal - 5))
    page.wait_for_timeout(100)
    unpaid_text = page.locator('#settlement-unpaid').inner_text()
    assert '0.00' in unpaid_text, unpaid_text
    form.get_by_role('button', name='保存结账记录').click()
    page.wait_for_timeout(150)
    s = app_state(page)
    session = next(x for x in s['sessions'] if x['id'] == t01_orders[0]['sessionId'])
    assert session['status'] == 'closed', session
    print('PASS: T01 settlement closes and returns table to free')

    # Persistence.
    page.reload(wait_until='networkidle')
    s2 = app_state(page)
    assert len(s2['orders']) == len(s['orders'])
    assert next(x for x in s2['sessions'] if x['id'] == session['id'])['status'] == 'closed'
    print('PASS: localStorage persistence after reload')
    print('ERRORS:', errors)
    assert not errors, errors
    page.screenshot(path='tests/screenshots/flows-complete.png', full_page=True)
    browser.close()





