from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto('http://127.0.0.1:8787', wait_until='networkidle')
    assert '单店茶饮经营原型' in page.title()
    assert page.locator('.role-nav .nav-pill').count() == 5
    page.locator('[data-action="scan-table"][data-table-id="T01"]').click()
    assert page.locator('.product-card').count() >= 8
    assert not errors, errors
    print('SERVER_OK', page.url, page.title())
    page.screenshot(path='tests/screenshots/server-live.png', full_page=True)
    browser.close()
