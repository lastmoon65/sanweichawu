from pathlib import Path
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json

from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()
KEY = 'tea-house-prototype-v1'
TZ = ZoneInfo('Asia/Shanghai')


def iso_at(day_offset: int, hour: int, minute: int) -> str:
    now = datetime.now(TZ)
    target = (now + timedelta(days=day_offset)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return target.isoformat(timespec='seconds')


def make_order(template_item, *, order_id, order_no, channel, status, created_at,
               completed_at=None, cancelled_at=None, table_id=None, session_id=None,
               product_name='测试茶', subtotal=40, loss_cost=0):
    item = deepcopy(template_item)
    item['productName'] = product_name
    item['quantity'] = 1
    item['unitPrice'] = subtotal
    item['subtotal'] = subtotal
    return {
        'id': order_id,
        'orderNo': order_no,
        'tableId': table_id,
        'sessionId': session_id,
        'channel': channel,
        'status': status,
        'items': [item],
        'subtotal': subtotal,
        'totalCost': item.get('totalCost', 0),
        'createdAt': created_at,
        'acceptedAt': created_at,
        'makingAt': created_at if status in ('making', 'completed', 'cancelled') else None,
        'completedAt': completed_at,
        'cancelledAt': cancelled_at,
        'cancellationReason': '销售口径测试',
        'lossCost': loss_cost,
    }


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--allow-file-access-from-files'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, timezone_id='Asia/Shanghai')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.goto(URL, wait_until='networkidle')

    page.get_by_role('button', name='重置演示数据').click()
    page.get_by_role('button', name='确认重置').click()
    page.wait_for_timeout(100)

    state = json.loads(page.evaluate('key => localStorage.getItem(key)', KEY))
    template_item = deepcopy(state['orders'][0]['items'][0])

    completed_cross_day = make_order(
        template_item,
        order_id='O-COMPLETE-CROSS-DAY',
        order_no='TEST-CROSS-DAY',
        channel='dine',
        status='completed',
        created_at=iso_at(-1, 23, 50),
        completed_at=iso_at(0, 10, 15),
        table_id='T01',
        session_id='S-CROSS-DAY',
        product_name='跨日完成茶',
        subtotal=40,
    )
    future_completion = make_order(
        template_item,
        order_id='O-FUTURE-COMPLETE',
        order_no='TEST-FUTURE',
        channel='takeaway',
        status='completed',
        created_at=iso_at(0, 9, 15),
        completed_at=iso_at(1, 11, 30),
        product_name='未来完成茶',
        subtotal=99,
    )
    unfinished_today = make_order(
        template_item,
        order_id='O-UNFINISHED-TODAY',
        order_no='TEST-UNFINISHED',
        channel='takeaway',
        status='making',
        created_at=iso_at(0, 10, 0),
        product_name='未完成茶',
        subtotal=77,
    )
    cancelled_today = make_order(
        template_item,
        order_id='O-CANCELLED-TODAY',
        order_no='TEST-CANCELLED',
        channel='dine',
        status='cancelled',
        created_at=iso_at(-1, 18, 0),
        cancelled_at=iso_at(0, 12, 0),
        table_id='T02',
        session_id='S-CANCELLED',
        product_name='今日取消茶',
        subtotal=55,
        loss_cost=4,
    )

    state['orders'] = [completed_cross_day, future_completion, unfinished_today, cancelled_today]
    state['sessions'] = []
    state['settlements'] = []
    state['inventoryTransactions'] = []
    state['payments'] = [
        {
            'id': 'PAY-TODAY-FUTURE-ORDER',
            'paymentNo': 'PAY-TODAY-FUTURE-ORDER',
            'orderId': future_completion['id'],
            'sessionId': None,
            'amount': 10,
            'status': 'ACTIVE',
            'receivedAt': iso_at(0, 13, 0),
            'note': '今天收到的钱，即使订单明天才完成也计入今日实收',
        },
        {
            'id': 'PAY-YESTERDAY',
            'paymentNo': 'PAY-YESTERDAY',
            'orderId': completed_cross_day['id'],
            'sessionId': None,
            'amount': 8,
            'status': 'ACTIVE',
            'receivedAt': iso_at(-1, 14, 0),
            'note': '昨天的收款不进入今天的实收',
        },
    ]
    state['refunds'] = [
        {
            'id': 'REF-TODAY',
            'refundNo': 'REF-TODAY',
            'paymentId': 'PAY-TODAY-FUTURE-ORDER',
            'orderId': future_completion['id'],
            'sessionId': None,
            'amount': 2,
            'reason': '今日部分退款',
            'status': 'ACTIVE',
            'refundedAt': iso_at(0, 14, 0),
        }
    ]

    page.evaluate('([key, value]) => localStorage.setItem(key, value)', [KEY, json.dumps(state, ensure_ascii=False)])
    page.reload(wait_until='networkidle')
    page.locator('.nav-pill[data-view="analytics"]').click()
    page.wait_for_timeout(100)

    metrics = page.locator('.analytics-metrics .metric-card')
    assert metrics.nth(0).locator('strong').inner_text() == '1'
    assert metrics.nth(1).locator('strong').inner_text() == '¥40.00'
    assert metrics.nth(4).locator('strong').inner_text() == '¥8.00'
    print('PASS: sales uses completedAt day while net cash follows payment/refund event day')

    rank_rows = page.locator('.rank-row')
    assert rank_rows.count() == 1
    rank_text = rank_rows.first.inner_text()
    expected_gross = 40 - float(completed_cross_day['totalCost'])
    assert '跨日完成茶' in rank_text and f'¥{expected_gross:.2f}' in rank_text
    assert '未来完成茶' not in rank_text and '未完成茶' not in rank_text and '今日取消茶' not in rank_text
    print('PASS: product ranking and material gross include only orders completed today')

    table_rows = page.locator('.simple-table-row')
    assert table_rows.count() == 1
    table_text = table_rows.first.inner_text()
    assert 'T01' in table_text and '¥40.00' in table_text and 'T02' not in table_text
    print('PASS: table sales include completed dine orders only')

    completed_hour = page.locator('.hour-column').nth(10 - 9)
    future_hour = page.locator('.hour-column').nth(11 - 9)
    assert completed_hour.locator('.bar').get_attribute('data-value') == '¥40.00'
    assert future_hour.locator('.bar').get_attribute('data-value') == '¥0.00'
    print('PASS: hourly sales use completedAt, not createdAt or a future completion date')

    legend = page.locator('.chart-legend').inner_text()
    assert '取消损耗 ¥4.00' in legend
    print('PASS: cancellation loss remains separate from normal sales gross profit')

    assert not errors, errors
    browser.close()
