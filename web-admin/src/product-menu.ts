import { API_BASE_URL, NetworkError, UnauthorizedSessionError } from './staff-auth';

export type MenuStatus = 'ACTIVE' | 'DISABLED';

export interface Category {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly status: MenuStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductVariant {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly priceFen: string;
  readonly inventoryMode: 'UNMANAGED';
  readonly status: MenuStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Product {
  readonly id: string;
  readonly storeId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly status: MenuStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly variants: ProductVariant[];
}

export interface CategoryInput {
  readonly name: string;
  readonly sortOrder?: number;
  readonly status?: MenuStatus;
}

export interface ProductInput {
  readonly categoryId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly sortOrder?: number;
  readonly status?: MenuStatus;
}

export interface ProductVariantInput {
  readonly name: string;
  readonly priceFen: string;
  readonly sortOrder?: number;
}

export interface CreateProductInput extends ProductInput {
  readonly variants: ProductVariantInput[];
}

export interface VariantInput {
  readonly name: string;
  readonly priceFen: string;
  readonly sortOrder?: number;
  readonly status?: MenuStatus;
}

export class MenuRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super('menu-request-error');
    this.name = 'MenuRequestError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMenuStatus(value: unknown): value is MenuStatus {
  return value === 'ACTIVE' || value === 'DISABLED';
}

function isCategory(value: unknown): value is Category {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.storeId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.sortOrder === 'number' &&
    isMenuStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isVariant(value: unknown): value is ProductVariant {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.priceFen === 'string' &&
    value.inventoryMode === 'UNMANAGED' &&
    isMenuStatus(value.status) &&
    typeof value.sortOrder === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.storeId === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.name === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    (value.imageUrl === null || typeof value.imageUrl === 'string') &&
    isMenuStatus(value.status) &&
    typeof value.sortOrder === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    Array.isArray(value.variants) &&
    value.variants.every(isVariant)
  );
}

function getApiData(payload: unknown): unknown {
  return isRecord(payload) ? payload.data : undefined;
}

function getErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }
  return typeof payload.error.code === 'string' ? payload.error.code : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function requestMenuData(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });
  } catch {
    throw new NetworkError();
  }

  const payload = await readJson(response);
  if (response.status === 401) {
    throw new UnauthorizedSessionError();
  }
  if (!response.ok) {
    throw new MenuRequestError(response.status, getErrorCode(payload));
  }
  return getApiData(payload);
}

function expectCategory(value: unknown): Category {
  if (!isCategory(value)) {
    throw new MenuRequestError(200);
  }
  return value;
}

function expectProduct(value: unknown): Product {
  if (!isProduct(value)) {
    throw new MenuRequestError(200);
  }
  return value;
}

function expectVariant(value: unknown): ProductVariant {
  if (!isVariant(value)) {
    throw new MenuRequestError(200);
  }
  return value;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function listCategories(accessToken: string): Promise<Category[]> {
  const data = await requestMenuData(accessToken, '/categories');
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isCategory)) {
    throw new MenuRequestError(200);
  }
  return data.items;
}

export async function createCategory(accessToken: string, input: CategoryInput): Promise<Category> {
  return expectCategory(await requestMenuData(accessToken, '/categories', jsonInit('POST', input)));
}

export async function updateCategory(
  accessToken: string,
  categoryId: string,
  input: Partial<CategoryInput>,
): Promise<Category> {
  return expectCategory(
    await requestMenuData(
      accessToken,
      `/categories/${encodeURIComponent(categoryId)}`,
      jsonInit('PATCH', input),
    ),
  );
}

export async function deleteCategory(accessToken: string, categoryId: string): Promise<Category> {
  return expectCategory(
    await requestMenuData(accessToken, `/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    }),
  );
}

export async function listProducts(accessToken: string, categoryId?: string): Promise<Product[]> {
  const query = categoryId === undefined ? '' : `?categoryId=${encodeURIComponent(categoryId)}`;
  const data = await requestMenuData(accessToken, `/products${query}`);
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isProduct)) {
    throw new MenuRequestError(200);
  }
  return data.items;
}

export async function createProduct(
  accessToken: string,
  input: CreateProductInput,
): Promise<Product> {
  return expectProduct(await requestMenuData(accessToken, '/products', jsonInit('POST', input)));
}

export async function updateProduct(
  accessToken: string,
  productId: string,
  input: Partial<ProductInput>,
): Promise<Product> {
  return expectProduct(
    await requestMenuData(
      accessToken,
      `/products/${encodeURIComponent(productId)}`,
      jsonInit('PATCH', input),
    ),
  );
}

export async function deleteProduct(accessToken: string, productId: string): Promise<Product> {
  return expectProduct(
    await requestMenuData(accessToken, `/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    }),
  );
}

export async function createVariant(
  accessToken: string,
  productId: string,
  input: VariantInput,
): Promise<ProductVariant> {
  return expectVariant(
    await requestMenuData(
      accessToken,
      `/products/${encodeURIComponent(productId)}/variants`,
      jsonInit('POST', input),
    ),
  );
}

export async function updateVariant(
  accessToken: string,
  productId: string,
  variantId: string,
  input: Partial<VariantInput>,
): Promise<ProductVariant> {
  return expectVariant(
    await requestMenuData(
      accessToken,
      `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
      jsonInit('PATCH', input),
    ),
  );
}

export async function deleteVariant(
  accessToken: string,
  productId: string,
  variantId: string,
): Promise<ProductVariant> {
  return expectVariant(
    await requestMenuData(
      accessToken,
      `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
      { method: 'DELETE' },
    ),
  );
}

export function parseFenInput(value: string): string | null {
  const normalized = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(normalized)) {
    return null;
  }
  let parsed: bigint;
  try {
    parsed = BigInt(normalized);
  } catch {
    return null;
  }
  return parsed <= 9_223_372_036_854_775_807n ? normalized : null;
}

export function formatFenAsYuan(priceFen: string): string {
  if (!/^(0|[1-9]\d*)$/.test(priceFen)) {
    return priceFen;
  }
  const fen = BigInt(priceFen);
  const yuan = fen / 100n;
  const cents = fen % 100n;
  return `${yuan.toString()}.${cents.toString().padStart(2, '0')}`;
}
