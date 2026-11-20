import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import type { Category, Product, ProductVariant } from '../src/product-menu';
import { formatFenAsYuan, parseFenInput } from '../src/product-menu';
import { SESSION_EXPIRED_MESSAGE, STAFF_SESSION_TOKEN_KEY } from '../src/staff-auth';
import type { Staff } from '../src/staff-auth';

const STAFF: Staff = {
  staffId: 'staff-menu-001',
  storeId: 'store-menu-001',
  role: 'MANAGER',
  name: '林晓',
  username: 'manager.lin',
};

const CATEGORY_HOT: Category = {
  id: '9007199254740993',
  storeId: 'store-menu-001',
  name: '热茶',
  sortOrder: 1,
  status: 'DISABLED',
  createdAt: '2026-11-19T01:02:03.456Z',
  updatedAt: '2026-11-19T02:03:04.567Z',
};

const CATEGORY_COLD: Category = {
  id: '9007199254740994',
  storeId: 'store-menu-001',
  name: '冷饮',
  sortOrder: 2,
  status: 'ACTIVE',
  createdAt: '2026-11-19T01:02:03.456Z',
  updatedAt: '2026-11-19T03:04:05.678Z',
};

const VARIANT_SMALL: ProductVariant = {
  id: '9007199254740995',
  productId: '9007199254740996',
  name: '小碗',
  priceFen: '1250',
  inventoryMode: 'UNMANAGED',
  status: 'ACTIVE',
  sortOrder: 1,
  createdAt: '2026-11-19T01:02:03.456Z',
  updatedAt: '2026-11-19T02:03:04.567Z',
};

const VARIANT_LARGE: ProductVariant = {
  ...VARIANT_SMALL,
  id: '9007199254740997',
  name: '大碗',
  priceFen: '0',
  sortOrder: 2,
};

const PRODUCT_NOODLE: Product = {
  id: '9007199254740996',
  storeId: 'store-menu-001',
  categoryId: CATEGORY_HOT.id,
  name: '牛肉面',
  description: '招牌汤面',
  imageUrl: null,
  status: 'ACTIVE',
  sortOrder: 0,
  createdAt: '2026-11-19T01:02:03.456Z',
  updatedAt: '2026-11-19T02:03:04.567Z',
  variants: [VARIANT_SMALL, VARIANT_LARGE],
};

type Route = () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successResponse(data: unknown): Response {
  return jsonResponse({ data, requestId: 'request-test' });
}

function errorResponse(code: string, status: number): Response {
  return jsonResponse(
    {
      error: { code, message: 'test error', details: null },
      requestId: 'request-test',
    },
    status,
  );
}

interface FetchOptions {
  readonly categories?: Category[];
  readonly products?: Product[];
  readonly routes?: Record<string, Route>;
}

function installFetch(options: FetchOptions = {}) {
  const routes: Record<string, Route> = {
    'GET /api/v1/auth/staff/me': () => successResponse(STAFF),
    'GET /api/v1/dining-tables': () => successResponse({ items: [] }),
    'GET /api/v1/categories': () => successResponse({ items: options.categories ?? [] }),
    'GET /api/v1/products': () => successResponse({ items: options.products ?? [] }),
    ...options.routes,
  };
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init as RequestInit | undefined)?.method ?? 'GET';
    const route = routes[`${method} ${url}`];
    if (!route) {
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }
    return route();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderSignedIn(options: FetchOptions = {}) {
  sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'menu-fake-token');
  const fetchMock = installFetch(options);
  render(<App />);
  expect(await screen.findByRole('heading', { name: '菜单管理' })).toBeInTheDocument();
  expect(
    await screen.findByText(
      `共 ${options.categories?.length ?? 0} 个分类 / ${options.products?.length ?? 0} 个商品`,
    ),
  ).toBeInTheDocument();
  return fetchMock;
}

function categoryTable(): HTMLElement {
  return screen.getByRole('table', { name: '分类列表' });
}

function productCard(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('article');
  if (!card) {
    throw new Error(`Product card not found for ${name}`);
  }
  return card;
}

function callsFor(fetchMock: ReturnType<typeof installFetch>, method: string, url: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const callUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return callUrl === url && ((init as RequestInit | undefined)?.method ?? 'GET') === method;
  });
}

function fillNewCategory(name: string) {
  fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: name } });
}

describe('product menu management for signed-in staff', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('loads categories, products and variants including disabled records with string ids and yuan display', async () => {
    const fetchMock = await renderSignedIn({
      categories: [CATEGORY_HOT, CATEGORY_COLD],
      products: [PRODUCT_NOODLE],
    });

    const categories = within(categoryTable());
    expect(categories.getByText('热茶')).toBeInTheDocument();
    expect(categories.getByText('已停用')).toBeInTheDocument();
    expect(categories.getByText(CATEGORY_HOT.updatedAt)).toBeInTheDocument();

    const card = within(productCard('牛肉面'));
    expect(card.getByText('招牌汤面')).toBeInTheDocument();
    expect(card.getByText('¥12.50')).toBeInTheDocument();
    expect(card.getByText('（1250 分）')).toBeInTheDocument();
    expect(card.getByText('¥0.00')).toBeInTheDocument();
    expect(card.getByText(`更新时间：${PRODUCT_NOODLE.updatedAt}`)).toBeInTheDocument();

    expect(callsFor(fetchMock, 'GET', '/api/v1/categories')).toHaveLength(1);
    expect(callsFor(fetchMock, 'GET', '/api/v1/products')).toHaveLength(1);
    expect(callsFor(fetchMock, 'GET', '/api/v1/products')[0]?.[1]).toEqual({
      headers: { Authorization: 'Bearer menu-fake-token' },
    });
  });

  it('creates and renames a category with trimmed input and string ids', async () => {
    const created: Category = {
      ...CATEGORY_COLD,
      id: '9007199254741000',
      name: '冷饮',
      sortOrder: 3,
      status: 'ACTIVE',
    };
    const renamed: Category = { ...created, name: '冰饮', status: 'DISABLED' };
    const fetchMock = await renderSignedIn({
      categories: [],
      products: [],
      routes: {
        'POST /api/v1/categories': () => successResponse(created),
        'PATCH /api/v1/categories/9007199254741000': () => successResponse(renamed),
      },
    });

    expect(await screen.findByText('暂无分类，请新建第一个分类。')).toBeInTheDocument();
    fillNewCategory('  冷饮  ');
    fireEvent.change(screen.getByLabelText('分类排序'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '新建分类' }));

    await screen.findByRole('table', { name: '分类列表' });
    const categories = within(categoryTable());
    expect(await categories.findByText('冷饮')).toBeInTheDocument();
    const createCall = callsFor(fetchMock, 'POST', '/api/v1/categories')[0];
    expect(createCall).toBeDefined();
    expect(JSON.parse(String((createCall?.[1] as RequestInit).body))).toEqual({
      name: '冷饮',
      sortOrder: 3,
      status: 'ACTIVE',
    });

    fireEvent.click(screen.getByRole('button', { name: '编辑分类 冷饮' }));
    fillNewCategory('  冰饮  ');
    fireEvent.change(screen.getByLabelText('分类状态'), { target: { value: 'DISABLED' } });
    fireEvent.click(screen.getByRole('button', { name: '保存分类' }));

    expect(await categories.findByText('冰饮')).toBeInTheDocument();
    expect(categories.getByText('已停用')).toBeInTheDocument();
    const updateCall = callsFor(fetchMock, 'PATCH', '/api/v1/categories/9007199254741000')[0];
    expect(updateCall).toBeDefined();
    expect(JSON.parse(String((updateCall?.[1] as RequestInit).body))).toEqual({
      name: '冰饮',
      sortOrder: 3,
      status: 'DISABLED',
    });
  });

  it('shows the shared conflict message when a name already exists', async () => {
    await renderSignedIn({
      categories: [CATEGORY_COLD],
      products: [],
      routes: {
        'POST /api/v1/categories': () => errorResponse('CONFLICT', 409),
      },
    });

    fillNewCategory('冷饮');
    fireEvent.click(screen.getByRole('button', { name: '新建分类' }));

    expect(await screen.findByText('该名称已被使用')).toBeInTheDocument();
  });

  it('keeps rows and shows the category, product and variant reference messages', async () => {
    await renderSignedIn({
      categories: [CATEGORY_HOT],
      products: [PRODUCT_NOODLE],
      routes: {
        'DELETE /api/v1/categories/9007199254740993': () =>
          errorResponse('CATEGORY_REFERENCED', 409),
        'DELETE /api/v1/products/9007199254740996': () => errorResponse('PRODUCT_REFERENCED', 409),
        'DELETE /api/v1/products/9007199254740996/variants/9007199254740997': () =>
          errorResponse('VARIANT_REFERENCED', 409),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '删除分类 热茶' }));
    expect(await screen.findByText('该分类下还有商品，无法删除')).toBeInTheDocument();
    expect(within(categoryTable()).getByText('热茶')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除商品 牛肉面' }));
    expect(await screen.findByText('该商品已有订单记录，无法删除')).toBeInTheDocument();
    expect(productCard('牛肉面')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除规格 大碗' }));
    expect(await screen.findByText('该规格已有订单记录，无法删除')).toBeInTheDocument();
    expect(within(productCard('牛肉面')).getByText('大碗')).toBeInTheDocument();
  });

  it('creates a product with at least one integer-fen variant and renders yuan without floats', async () => {
    const created: Product = {
      ...PRODUCT_NOODLE,
      id: '9007199254741001',
      name: '清汤面',
      description: '清淡',
      categoryId: CATEGORY_COLD.id,
      variants: [
        { ...VARIANT_SMALL, id: '9007199254741002', productId: '9007199254741001', name: '小碗' },
        {
          ...VARIANT_LARGE,
          id: '9007199254741003',
          productId: '9007199254741001',
          name: '大碗',
          priceFen: '0',
        },
      ],
    };
    const fetchMock = await renderSignedIn({
      categories: [CATEGORY_COLD],
      products: [],
      routes: {
        'POST /api/v1/products': () => successResponse(created),
      },
    });

    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '  清汤面  ' } });
    fireEvent.change(screen.getByLabelText('商品说明'), { target: { value: '  清淡  ' } });
    fireEvent.change(screen.getByLabelText('第1个规格名称'), { target: { value: ' 小碗 ' } });
    fireEvent.change(screen.getByLabelText('第1个规格价格（分）'), { target: { value: '1250' } });
    fireEvent.click(screen.getByRole('button', { name: '增加规格' }));
    fireEvent.change(screen.getByLabelText('第2个规格名称'), { target: { value: '大碗' } });
    fireEvent.change(screen.getByLabelText('第2个规格价格（分）'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '新建商品' }));

    expect(await screen.findByRole('heading', { name: '清汤面' })).toBeInTheDocument();
    const card = within(productCard('清汤面'));
    expect(card.getByText('¥12.50')).toBeInTheDocument();
    expect(card.getByText('¥0.00')).toBeInTheDocument();

    const createCall = callsFor(fetchMock, 'POST', '/api/v1/products')[0];
    expect(createCall).toBeDefined();
    expect(JSON.parse(String((createCall?.[1] as RequestInit).body))).toEqual({
      categoryId: CATEGORY_COLD.id,
      name: '清汤面',
      description: '清淡',
      sortOrder: 0,
      variants: [
        { name: '小碗', priceFen: '1250' },
        { name: '大碗', priceFen: '0' },
      ],
    });
  });

  it('rejects empty names and fractional prices before issuing a write request', async () => {
    const fetchMock = await renderSignedIn({ categories: [CATEGORY_COLD], products: [] });

    fireEvent.click(screen.getByRole('button', { name: '新建商品' }));
    expect(screen.getByText('请输入商品名称')).toBeInTheDocument();
    expect(screen.getByText('请输入规格名称')).toBeInTheDocument();
    expect(screen.getAllByText('价格必须是非负整数分')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('商品名称'), { target: { value: '面' } });
    fireEvent.change(screen.getByLabelText('第1个规格名称'), { target: { value: '小碗' } });
    fireEvent.change(screen.getByLabelText('第1个规格价格（分）'), {
      target: { value: '12.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新建商品' }));
    expect(screen.getByText('价格必须是非负整数分')).toBeInTheDocument();

    expect(callsFor(fetchMock, 'POST', '/api/v1/products')).toHaveLength(0);
  });

  it('updates a variant price using integer fen and the exact string id', async () => {
    const updated: ProductVariant = { ...VARIANT_SMALL, priceFen: '250' };
    const fetchMock = await renderSignedIn({
      categories: [CATEGORY_HOT],
      products: [PRODUCT_NOODLE],
      routes: {
        'PATCH /api/v1/products/9007199254740996/variants/9007199254740995': () =>
          successResponse(updated),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '编辑规格 小碗' }));
    fireEvent.change(screen.getByLabelText('规格价格（分）'), { target: { value: ' 250 ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存规格' }));

    expect(await within(productCard('牛肉面')).findByText('¥2.50')).toBeInTheDocument();
    const updateCall = callsFor(
      fetchMock,
      'PATCH',
      '/api/v1/products/9007199254740996/variants/9007199254740995',
    )[0];
    expect(updateCall).toBeDefined();
    expect(JSON.parse(String((updateCall?.[1] as RequestInit).body))).toEqual({
      name: '小碗',
      priceFen: '250',
      sortOrder: 1,
    });
  });

  it('toggles category, product and variant status without converting ids', async () => {
    const disabledCategory: Category = { ...CATEGORY_COLD, status: 'DISABLED' };
    const disabledProduct: Product = { ...PRODUCT_NOODLE, status: 'DISABLED' };
    const disabledVariant: ProductVariant = { ...VARIANT_SMALL, status: 'DISABLED' };
    const fetchMock = await renderSignedIn({
      categories: [CATEGORY_COLD],
      products: [PRODUCT_NOODLE],
      routes: {
        'PATCH /api/v1/categories/9007199254740994': () => successResponse(disabledCategory),
        'PATCH /api/v1/products/9007199254740996': () => successResponse(disabledProduct),
        'PATCH /api/v1/products/9007199254740996/variants/9007199254740995': () =>
          successResponse(disabledVariant),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '停用分类 冷饮' }));
    expect(await within(categoryTable()).findByText('已停用')).toBeInTheDocument();
    expect(callsFor(fetchMock, 'PATCH', '/api/v1/categories/9007199254740994')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '停用商品 牛肉面' }));
    await within(productCard('牛肉面')).findByText('已停用');
    expect(callsFor(fetchMock, 'PATCH', '/api/v1/products/9007199254740996')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '停用规格 小碗' }));
    expect(await screen.findByRole('button', { name: '启用规格 小碗' })).toBeInTheDocument();
    expect(
      callsFor(fetchMock, 'PATCH', '/api/v1/products/9007199254740996/variants/9007199254740995'),
    ).toHaveLength(1);
  });

  it('shows the network message when menu loading fails', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'menu-fake-token');
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === '/api/v1/auth/staff/me') {
        return successResponse(STAFF);
      }
      if (url === '/api/v1/dining-tables') {
        return successResponse({ items: [] });
      }
      if (url === '/api/v1/categories') {
        throw new TypeError('Failed to fetch');
      }
      if (url === '/api/v1/products') {
        return successResponse({ items: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('网络异常，请稍后重试')).toBeInTheDocument();
  });

  it('uses the existing session-expired flow when the menu API returns 401', async () => {
    sessionStorage.setItem(STAFF_SESSION_TOKEN_KEY, 'menu-fake-token');
    installFetch({
      routes: {
        'GET /api/v1/categories': () => errorResponse('UNAUTHORIZED', 401),
      },
    });

    render(<App />);

    expect(await screen.findByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(sessionStorage.getItem(STAFF_SESSION_TOKEN_KEY)).toBeNull();
  });

  it('parses and formats fen with integer arithmetic only', () => {
    expect(parseFenInput('0')).toBe('0');
    expect(parseFenInput(' 1250 ')).toBe('1250');
    expect(parseFenInput('01')).toBeNull();
    expect(parseFenInput('-1')).toBeNull();
    expect(parseFenInput('12.5')).toBeNull();
    expect(parseFenInput('1e2')).toBeNull();
    expect(parseFenInput('1.0')).toBeNull();
    expect(parseFenInput('9223372036854775808')).toBeNull();
    expect(formatFenAsYuan('1250')).toBe('12.50');
    expect(formatFenAsYuan('0')).toBe('0.00');
    expect(formatFenAsYuan('900719925474099301')).toBe('9007199254740993.01');
  });
});
