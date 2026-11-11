from pathlib import Path
from playwright.sync_api import sync_playwright
url = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--allow-file-access-from-files'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('console', lambda msg: errors.append(f'{msg.type}: {msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.goto(url, wait_until='networkidle')
    page.wait_for_timeout(800)
    print('URL:', page.url)
    print('TITLE:', page.title())
    print('H1:', page.locator('h1').first.inner_text())
    print('HEADER NAV:', page.locator('.role-nav .nav-pill').count())
    print('ERRORS:', errors)
    page.screenshot(path='tests/screenshots/initial.png', full_page=True)
    browser.close()


