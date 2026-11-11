from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
KEY = 'tea-house-prototype-v1'

def state(page): return json.loads(page.evaluate("key=>localStorage.getItem(key)", KEY))
def nav(page, view):
    page.locator(f'.nav-pill[data-view="{view}"]').click(); page.wait_for_timeout(80)
def reset(page):
    page.get_by_role('button', name='重置演示数据').click(); page.get_by_role('button', name='确认重置').click(); page.wait_for_timeout(120)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--allow-file-access-from-files'])
    page=browser.new_page(viewport={'width':1366,'height':900})
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='networkidle'); reset(page)

    # Create T05 order and confirm unfinished table cannot be closed.
    page.locator('[data-action="scan-table"][data-table-id="T05"]').click()
    page.locator('.product-card').filter(has_text='龙井').click()
    page.get_by_role('button',name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="submit-order"]').click(); page.wait_for_timeout(100)
    s=state(page); order=next(o for o in s['orders'] if o.get('tableId')=='T05')
    nav(page,'tables')
    page.locator('[data-action="open-table"][data-table-id="T05"]').click()
    expect(page.locator('.blocking-warning')).to_be_visible()
    assert page.locator('form[data-form="settlement"] button[type="submit"]').is_disabled()
    page.locator('[data-action="close-modal"]').click()
    print('PASS: unfinished table is blocked from closing')

    # Complete order; customer sees completed state.
    nav(page,'workbench')
    card=page.locator('.order-card').filter(has_text=order['orderNo'])
    card.get_by_role('button',name='接单').click(); page.wait_for_timeout(50)
    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button',name='开始制作').click(); page.wait_for_timeout(50)
    page.locator('.order-card').filter(has_text=order['orderNo']).get_by_role('button',name='制作完成').click(); page.wait_for_timeout(80)
    nav(page,'customer')
    page.locator('[data-action="customer-tab"][data-tab="orders"]').click()
    matching_cards = page.locator('.customer-order-card').filter(has_text=order['orderNo'])
    expect(matching_cards).to_have_count(2)
    assert all('已完成' in matching_cards.nth(i).inner_text() for i in range(2))
    print('PASS: customer sees completed status')

    # Partial settlement persists and keeps table in checkout state.
    nav(page,'tables')
    page.locator('[data-action="open-table"][data-table-id="T05"]').click()
    form=page.locator('form[data-form="settlement"]')
    subtotal=float(order['subtotal'])
    form.locator('input[name="discount"]').fill('2')
    form.locator('input[name="paid"]').fill(str(round(subtotal-2-10,2)))
    form.locator('button[type="submit"]').click(); page.wait_for_timeout(100)
    s=state(page); session=next(x for x in s['sessions'] if x['id']==order['sessionId'])
    assert session['status']=='open'
    page.locator('[data-action="open-table"][data-table-id="T05"]').click()
    assert '10.00' in page.locator('#settlement-unpaid').inner_text()
    page.locator('[data-action="close-modal"]').click()
    print('PASS: partial settlement keeps table open with unpaid balance')

    # Full settlement closes session.
    page.locator('[data-action="open-table"][data-table-id="T05"]').click()
    form=page.locator('form[data-form="settlement"]')
    form.locator('input[name="paid"]').fill(str(round(subtotal-2,2)))
    form.locator('button[type="submit"]').click(); page.wait_for_timeout(100)
    s=state(page); session=next(x for x in s['sessions'] if x['id']==order['sessionId'])
    assert session['status']=='closed'
    print('PASS: full settlement closes session')

    # Add product with a new variant.
    nav(page,'inventory')
    page.locator('[data-action="inventory-tab"][data-tab="products"]').click()
    page.locator('[data-action="add-product"]').click()
    pf=page.locator('form[data-form="product"]')
    pf.locator('input[name="name"]').fill('凤凰单丛')
    pf.locator('input[name="category"]').fill('乌龙')
    pf.locator('input[name="subtitle"]').fill('蜜兰香 · 山韵清长')
    pf.locator('textarea[name="description"]').fill('新增演示茶品，用于验证商品管理。')
    pf.locator('.variant-row').first.locator('.variant-name').fill('单人份')
    pf.locator('.variant-row').first.locator('.variant-price').fill('58')
    pf.locator('.variant-row').first.locator('.variant-methods').fill('盖碗冲泡,壶泡')
    pf.locator('[data-action="add-variant-row"]').click()
    rows=pf.locator('.variant-row'); rows.nth(1).locator('.variant-name').fill('双人份'); rows.nth(1).locator('.variant-price').fill('108'); rows.nth(1).locator('.variant-methods').fill('盖碗冲泡')
    pf.locator('button[type="submit"]').click(); page.wait_for_timeout(100)
    s=state(page); new_product=next(p for p in s['products'] if p['name']=='凤凰单丛')
    assert len(new_product['variants'])==2 and new_product['variants'][1]['price']==108
    print('PASS: product and multi-variant create')

    # Add material.
    page.locator('[data-action="inventory-tab"][data-tab="materials"]').click()
    page.locator('[data-action="add-material"]').click()
    mf=page.locator('form[data-form="material"]')
    mf.locator('input[name="name"]').fill('杯盖')
    mf.locator('select[name="unit"]').select_option('个')
    mf.locator('input[name="stock"]').fill('100')
    mf.locator('input[name="warning"]').fill('20')
    mf.locator('input[name="price"]').fill('0.18')
    mf.locator('button[type="submit"]').click(); page.wait_for_timeout(100)
    s=state(page); lid=next(m for m in s['materials'] if m['name']=='杯盖')
    assert lid['stock']==100 and lid['price']==0.18
    print('PASS: material creation')

    # Reset returns exact demo baseline counts.
    reset(page)
    s=state(page)
    assert len(s['products'])==8 and len(s['orders'])==4 and len(s['sessions'])==2
    print('PASS: reset restores baseline')

    # Capture representative role screenshots.
    page.set_viewport_size({'width':1440,'height':1000}); nav(page,'workbench'); page.screenshot(path='tests/screenshots/workbench.png',full_page=True)
    nav(page,'tables'); page.screenshot(path='tests/screenshots/tables.png',full_page=True)
    nav(page,'inventory'); page.screenshot(path='tests/screenshots/inventory.png',full_page=True)
    nav(page,'analytics'); page.screenshot(path='tests/screenshots/analytics.png',full_page=True)
    nav(page,'customer'); page.set_viewport_size({'width':390,'height':844}); page.screenshot(path='tests/screenshots/customer-mobile.png',full_page=True)
    print('ERRORS:',errors); assert not errors, errors
    browser.close()




