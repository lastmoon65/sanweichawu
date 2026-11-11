from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
KEY = 'tea-house-prototype-v1'

def state(page):
    return json.loads(page.evaluate('k => localStorage.getItem(k)', KEY))

def create_takeaway(page, product):
    page.locator('.customer-mode-switch [data-mode="takeaway"]').click()
    page.locator('[data-action="customer-tab"][data-tab="catalog"]').click()
    page.locator('.product-card').filter(has_text=product).click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
    return state(page)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    page.get_by_role('button', name='重置演示数据').click()
    page.get_by_role('button', name='确认重置').click()
    page.wait_for_timeout(100)

    s = create_takeaway(page, '茉莉花茶')
    order = max([o for o in s['orders'] if o['channel'] == 'takeaway'], key=lambda o: o['createdAt'])
    before = len([x for x in s.get('payments', []) if x.get('orderId') == order['id']])
    assert before == 0

    page.locator('.nav-pill[data-view="workbench"]').click()
    card = page.locator('.order-card').filter(has_text=order['orderNo'])
    card.locator('[data-action="open-takeaway-payment"]').click()
    form = page.locator('form[data-form="takeaway-payment"]')
    expect(form.locator('input[name="amount"]')).to_be_visible()
    form.locator('input[name="amount"]').fill(str(order['subtotal']))
    form.locator('input[name="note"]').fill('制作前顾客已付款')
    form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    payments_before_complete = [x for x in s['payments'] if x.get('orderId') == order['id']]
    assert len(payments_before_complete) == 1 and payments_before_complete[0]['amount'] == order['subtotal']
    print('PASS: takeaway payment can be recorded before production completion')

    # A paid takeaway order cannot be cancelled until a refund is recorded.
    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button', name='取消').click()
    page.locator('form[data-form="cancel-order"] input[name="reason"]').fill('未退款直接取消')
    page.locator('form[data-form="cancel-order"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert next(o for o in s['orders'] if o['id'] == order['id'])['status'] == 'pending'
    page.locator('.modal-close').click()
    print('PASS: paid takeaway cancellation is blocked before refund')

    card = page.locator('.order-card').filter(has_text=order['orderNo'])
    card.get_by_role('button', name='接单').click()
    page.wait_for_timeout(50)
    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button', name='开始制作').click()
    page.wait_for_timeout(50)
    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button', name='制作完成').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert len([x for x in s['payments'] if x.get('orderId') == order['id']]) == 1
    print('PASS: completing order does not create another payment')

    page.locator('.nav-pill[data-view="customer"]').click()
    s = create_takeaway(page, '红茶')
    order2 = max([o for o in s['orders'] if o['channel'] == 'takeaway'], key=lambda o: o['createdAt'])
    assert len([x for x in s.get('payments', []) if x.get('orderId') == order2['id']]) == 0
    page.locator('.nav-pill[data-view="workbench"]').click()
    for action in ['接单', '开始制作', '制作完成']:
        page.locator('.order-card').filter(has_text=order2['orderNo']).get_by_role('button', name=action).click()
        page.wait_for_timeout(50)
    s = state(page)
    assert len([x for x in s.get('payments', []) if x.get('orderId') == order2['id']]) == 0
    print('PASS: completed-but-unpaid takeaway remains unpaid until manually recorded')
    assert not errors, errors
    browser.close()

