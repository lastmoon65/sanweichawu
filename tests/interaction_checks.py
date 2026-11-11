from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
URL=(Path(__file__).resolve().parent.parent / 'index.html').as_uri(); KEY='tea-house-prototype-v1'
def state(page): return json.loads(page.evaluate('k=>localStorage.getItem(k)',KEY))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--allow-file-access-from-files'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='networkidle')
    page.get_by_role('button',name='重置演示数据').click(); page.get_by_role('button',name='确认重置').click(); page.wait_for_timeout(100)
    page.locator('[data-action="scan-table"][data-table-id="T01"]').click()
    page.locator('.product-card').filter(has_text='大红袍').click()
    page.get_by_role('button',name='加入购物车').click()
    page.locator('.cart-dock button').click()
    page.locator('[data-action="edit-cart-line"]').click()
    expect(page.get_by_role('button',name='保存修改')).to_be_visible()
    page.locator('[data-action="detail-variant"][data-variant-id="v-dhp-2"]').click()
    page.get_by_role('button',name='保存修改').click()
    s=state(page)
    assert len(s['customer']['cart'])==1 and s['customer']['cart'][0]['variantId']=='v-dhp-2' and s['customer']['cart'][0]['quantity']==1
    print('PASS: cart line config can be edited in place')
    page.locator('.cart-dock button').click()
    page.locator('.modal-close').click()
    page.locator('.nav-pill[data-view="analytics"]').click()
    expect(page.locator('.rank-switch button')).to_have_count(4)
    for metric,label in [('revenue','销售额'),('qty','销量'),('margin','毛利率'),('gross','毛利额')]:
        page.locator(f'[data-action="ranking-metric"][data-metric="{metric}"]').click()
        expect(page.locator('.rank-switch button.active')).to_have_text(label)
    print('PASS: all four product ranking modes work')
    assert not errors, errors
    browser.close()



