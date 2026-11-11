import re
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
KEY = 'tea-house-prototype-v1'

def state(page):
    return json.loads(page.evaluate('k => localStorage.getItem(k)', KEY))

def create_takeaway(page):
    page.locator('.customer-mode-switch [data-mode="takeaway"]').click()
    page.locator('[data-action="customer-tab"][data-tab="catalog"]').click()
    page.locator('.product-card').filter(has_text='茉莉花茶').click()
    page.get_by_role('button', name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    return max([o for o in s['orders'] if o['channel'] == 'takeaway'], key=lambda o: o['createdAt'])

def open_payment_record(page, order):
    page.locator('.order-card').filter(has_text=order['orderNo']).locator('[data-action="open-takeaway-payment"]').click()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    page.get_by_role('button', name='重置演示数据').click()
    page.get_by_role('button', name='确认重置').click()
    page.wait_for_timeout(100)

    order = create_takeaway(page)
    page.locator('.nav-pill[data-view="workbench"]').click()
    open_payment_record(page, order)
    form = page.locator('form[data-form="takeaway-payment"]')
    form.locator('input[name="amount"]').fill(str(order['subtotal']))
    form.locator('input[name="note"]').fill('全额现金收款')
    form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    payment = next(p for p in s['payments'] if p.get('orderId') == order['id'])
    original_payment = dict(payment)

    open_payment_record(page, order)
    page.get_by_role('button', name='登记退款').click()
    refund_form = page.locator('form[data-form="takeaway-refund"]')
    refund_form.locator('input[name="amount"]').fill('5')
    refund_form.locator('input[name="reason"]').fill('部分退款')
    refund_form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert len([r for r in s['refunds'] if r['paymentId'] == payment['id']]) == 1
    assert s['payments'][0]['amount'] == original_payment['amount']
    print('PASS: partial refund references original payment without changing it')

    page.locator('.modal-close').click()
    page.locator('.nav-pill[data-view="analytics"]').click()
    net_card = page.locator('.metric-card').filter(has_text='净实收').inner_text()
    expected_net = sum(item.get('paid', 0) for item in s['settlements']) + sum(item['amount'] for item in s['payments'] if item['status'] == 'ACTIVE') - sum(item['amount'] for item in s['refunds'] if item['status'] == 'ACTIVE')


    assert any(abs(float(value) - expected_net) < 0.001 for value in re.findall(r'\d+\.\d{2}', net_card)), net_card
    page.locator('.nav-pill[data-view="workbench"]').click()
    open_payment_record(page, order)

    page.get_by_role('button', name='登记退款').click()
    refund_form = page.locator('form[data-form="takeaway-refund"]')
    refund_form.locator('input[name="amount"]').fill('30')
    refund_form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert len([r for r in s['refunds'] if r['paymentId'] == payment['id']]) == 1
    page.locator('.modal-close').click()
    print('PASS: over-refund is rejected')

    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button', name='取消').click()
    page.locator('form[data-form="cancel-order"] input[name="reason"]').fill('未退完就取消')
    page.locator('form[data-form="cancel-order"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert next(o for o in s['orders'] if o['id'] == order['id'])['status'] == 'pending'
    page.locator('.modal-close').click()
    print('PASS: partial refund keeps cancellation blocked while net paid remains')

    open_payment_record(page, order)
    page.get_by_role('button', name='登记退款').click()
    refund_form = page.locator('form[data-form="takeaway-refund"]')
    refund_form.locator('input[name="amount"]').fill('20')
    refund_form.locator('input[name="reason"]').fill('订单取消，退清余款')
    refund_form.locator('button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    payments = [p for p in s['payments'] if p.get('orderId') == order['id']]
    refunds = [r for r in s['refunds'] if r['paymentId'] == payment['id']]
    assert len(payments) == 1 and sum(r['amount'] for r in refunds) == payment['amount']
    page.locator('.modal-close').click()
    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button', name='取消').click()
    page.locator('form[data-form="cancel-order"] input[name="reason"]').fill('已全额退款')
    page.locator('form[data-form="cancel-order"] button[type="submit"]').click()
    page.wait_for_timeout(100)
    s = state(page)
    assert next(o for o in s['orders'] if o['id'] == order['id'])['status'] == 'cancelled'
    assert len([p for p in s['payments'] if p.get('orderId') == order['id']]) == 1
    assert len([r for r in s['refunds'] if r['paymentId'] == payment['id']]) == 2
    page.locator('.nav-pill[data-view="analytics"]').click()
    net_after_cancel = page.locator('.metric-card').filter(has_text='净实收').inner_text()
    expected_net_after = sum(item.get('paid', 0) for item in s['settlements']) + sum(item['amount'] for item in s['payments'] if item['status'] == 'ACTIVE') - sum(item['amount'] for item in s['refunds'] if item['status'] == 'ACTIVE')
    assert any(abs(float(value) - expected_net_after) < 0.001 for value in re.findall(r'\d+\.\d{2}', net_after_cancel)), net_after_cancel
    refund_legend = page.locator('.chart-legend').inner_text()
    expected_refunds = sum(item["amount"] for item in s["refunds"] if item["status"] == "ACTIVE")
    assert '退款' in refund_legend and any(abs(float(value) - expected_refunds) < 0.001 for value in re.findall(r'\d+\.\d{2}', refund_legend)), refund_legend
    print('PASS: full refund allows cancellation and preserves payment/refund history')
    assert not errors, errors
    browser.close()
