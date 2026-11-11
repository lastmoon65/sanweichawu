from pathlib import Path
from playwright.sync_api import sync_playwright
url=(Path(__file__).resolve().parent.parent / 'index.html').as_uri()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[]
    page.on('console',lambda m: errors.append(f'{m.type}: {m.text}') if m.type=='error' else None)
    page.on('pageerror',lambda e: errors.append(f'pageerror: {e}'))
    page.goto(url,wait_until='networkidle')
    page.locator('[data-action="scan-table"][data-table-id="T01"]').click()
    page.locator('.product-card').filter(has_text='大红袍').click()
    page.get_by_role('button',name='加入购物车').click()
    assert page.locator('.cart-dock button').count()==1
    print('DIRECT_FILE_OK', page.title(), errors)
    page.screenshot(path='tests/screenshots/direct-file.png',full_page=True)
    browser.close()


