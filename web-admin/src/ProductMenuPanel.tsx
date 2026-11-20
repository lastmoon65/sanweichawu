import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  MenuRequestError,
  createCategory,
  createProduct,
  createVariant,
  deleteCategory,
  deleteProduct,
  deleteVariant,
  formatFenAsYuan,
  listCategories,
  listProducts,
  parseFenInput,
  updateCategory,
  updateProduct,
  updateVariant,
} from './product-menu';
import type { Category, MenuStatus, Product, ProductVariant } from './product-menu';
import { NETWORK_ERROR_MESSAGE, NetworkError, UnauthorizedSessionError } from './staff-auth';

interface ProductMenuPanelProps {
  readonly accessToken: string;
  readonly onSessionExpired: () => void;
}

interface DraftVariant {
  readonly key: number;
  readonly name: string;
  readonly priceFen: string;
}

interface DraftVariantErrors {
  name?: string;
  priceFen?: string;
}

interface VariantFormErrors {
  name?: string;
  priceFen?: string;
  sortOrder?: string;
}

const NAME_CONFLICT_MESSAGE = '该名称已被使用';
const CATEGORY_REFERENCED_MESSAGE = '该分类下还有商品，无法删除';
const PRODUCT_REFERENCED_MESSAGE = '该商品已有订单记录，无法删除';
const VARIANT_REFERENCED_MESSAGE = '该规格已有订单记录，无法删除';
const LAST_VARIANT_MESSAGE = '商品至少需要保留一个规格';
const MENU_LOAD_ERROR_MESSAGE = '菜单加载失败，请稍后重试';
const MENU_ACTION_ERROR_MESSAGE = '操作失败，请稍后重试';
const MENU_VALIDATION_MESSAGE = '请检查名称、价格或分类';
const INVALID_PRICE_MESSAGE = '价格必须是非负整数分';
const CATEGORY_NAME_MAX_LENGTH = 80;
const PRODUCT_NAME_MAX_LENGTH = 120;
const VARIANT_NAME_MAX_LENGTH = 80;

let nextDraftVariantKey = 1;

function createDraftVariant(): DraftVariant {
  return { key: nextDraftVariantKey++, name: '', priceFen: '' };
}

function compareIds(left: string, right: string): number {
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left.localeCompare(right);
}

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort(
    (left, right) => left.sortOrder - right.sortOrder || compareIds(left.id, right.id),
  );
}

function sortVariants(variants: ProductVariant[]): ProductVariant[] {
  return [...variants].sort(
    (left, right) => left.sortOrder - right.sortOrder || compareIds(left.id, right.id),
  );
}

function sortProducts(products: Product[]): Product[] {
  return [...products]
    .map((product) => ({ ...product, variants: sortVariants(product.variants) }))
    .sort((left, right) => left.sortOrder - right.sortOrder || compareIds(left.id, right.id));
}

function parseSortOrderInput(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return 0;
  }
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toggleStatus(status: MenuStatus): MenuStatus {
  return status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
}

function requestErrorMessage(error: unknown, validationMessage = MENU_VALIDATION_MESSAGE): string {
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error instanceof MenuRequestError) {
    if (error.code === 'CONFLICT') {
      return NAME_CONFLICT_MESSAGE;
    }
    if (error.code === 'CATEGORY_REFERENCED') {
      return CATEGORY_REFERENCED_MESSAGE;
    }
    if (error.code === 'PRODUCT_REFERENCED') {
      return PRODUCT_REFERENCED_MESSAGE;
    }
    if (error.code === 'VARIANT_REFERENCED') {
      return VARIANT_REFERENCED_MESSAGE;
    }
    if (error.code === 'VALIDATION_ERROR') {
      return validationMessage;
    }
  }
  return MENU_ACTION_ERROR_MESSAGE;
}

export function ProductMenuPanel({ accessToken, onSessionExpired }: ProductMenuPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('0');
  const [categoryStatus, setCategoryStatus] = useState<MenuStatus>('ACTIVE');
  const [categoryErrors, setCategoryErrors] = useState<{ name?: string; sortOrder?: string }>({});
  const [categoryActionError, setCategoryActionError] = useState<string | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productCategoryId, setProductCategoryId] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productSortOrder, setProductSortOrder] = useState('0');
  const [productErrors, setProductErrors] = useState<{
    categoryId?: string;
    name?: string;
    sortOrder?: string;
  }>({});
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([createDraftVariant()]);
  const [draftVariantErrors, setDraftVariantErrors] = useState<Record<number, DraftVariantErrors>>(
    {},
  );
  const [productActionError, setProductActionError] = useState<string | null>(null);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);

  const [variantProductId, setVariantProductId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantName, setVariantName] = useState('');
  const [variantPriceFen, setVariantPriceFen] = useState('');
  const [variantSortOrder, setVariantSortOrder] = useState('0');
  const [variantErrors, setVariantErrors] = useState<VariantFormErrors>({});
  const [variantActionError, setVariantActionError] = useState<string | null>(null);
  const [variantSubmitting, setVariantSubmitting] = useState(false);
  const autoCategoryInitialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([listCategories(accessToken), listProducts(accessToken)])
      .then(([loadedCategories, loadedProducts]) => {
        if (cancelled) {
          return;
        }
        setCategories(sortCategories(loadedCategories));
        setProducts(sortProducts(loadedProducts));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof UnauthorizedSessionError) {
          onSessionExpired();
          return;
        }
        setLoadError(
          error instanceof NetworkError ? NETWORK_ERROR_MESSAGE : MENU_LOAD_ERROR_MESSAGE,
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, onSessionExpired]);

  useEffect(() => {
    if (autoCategoryInitialized.current || categories.length === 0) {
      return;
    }
    autoCategoryInitialized.current = true;
    setProductCategoryId(categories[0]?.id ?? '');
  }, [categories]);

  const visibleProducts =
    selectedCategoryId === 'all'
      ? products
      : products.filter((product) => product.categoryId === selectedCategoryId);

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategorySortOrder('0');
    setCategoryStatus('ACTIVE');
    setCategoryErrors({});
    setCategoryActionError(null);
  };

  const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (categorySubmitting) {
      return;
    }

    const trimmedName = categoryName.trim();
    const parsedSortOrder = parseSortOrderInput(categorySortOrder);
    const nextErrors: { name?: string; sortOrder?: string } = {};
    if (!trimmedName) {
      nextErrors.name = '请输入分类名称';
    } else if (trimmedName.length > CATEGORY_NAME_MAX_LENGTH) {
      nextErrors.name = `分类名称不能超过${CATEGORY_NAME_MAX_LENGTH}个字符`;
    }
    if (parsedSortOrder === null) {
      nextErrors.sortOrder = '排序必须是整数';
    }
    if (nextErrors.name || nextErrors.sortOrder) {
      setCategoryErrors(nextErrors);
      setCategoryActionError(null);
      return;
    }

    setCategoryErrors({});
    setCategoryActionError(null);
    setCategorySubmitting(true);
    try {
      const saved = editingCategoryId
        ? await updateCategory(accessToken, editingCategoryId, {
            name: trimmedName,
            sortOrder: parsedSortOrder ?? 0,
            status: categoryStatus,
          })
        : await createCategory(accessToken, {
            name: trimmedName,
            sortOrder: parsedSortOrder ?? 0,
            status: categoryStatus,
          });
      setCategories((current) =>
        sortCategories(
          editingCategoryId
            ? current.map((category) => (category.id === saved.id ? saved : category))
            : [...current, saved],
        ),
      );
      resetCategoryForm();
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setCategoryActionError(requestErrorMessage(error));
      }
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setCategorySortOrder(String(category.sortOrder));
    setCategoryStatus(category.status);
    setCategoryErrors({});
    setCategoryActionError(null);
  };

  const handleCategoryStatus = async (category: Category) => {
    setCategoryActionError(null);
    try {
      const saved = await updateCategory(accessToken, category.id, {
        status: toggleStatus(category.status),
      });
      setCategories((current) =>
        sortCategories(current.map((entry) => (entry.id === saved.id ? saved : entry))),
      );
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setCategoryActionError(requestErrorMessage(error));
      }
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    setCategoryActionError(null);
    try {
      await deleteCategory(accessToken, category.id);
      setCategories((current) => current.filter((entry) => entry.id !== category.id));
      setProducts((current) => current.filter((entry) => entry.categoryId !== category.id));
      if (selectedCategoryId === category.id) {
        setSelectedCategoryId('all');
      }
      if (editingCategoryId === category.id) {
        resetCategoryForm();
      }
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setCategoryActionError(requestErrorMessage(error));
      }
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductName('');
    setProductDescription('');
    setProductSortOrder('0');
    setProductErrors({});
    setDraftVariants([createDraftVariant()]);
    setDraftVariantErrors({});
    setProductActionError(null);
    setProductCategoryId(
      selectedCategoryId === 'all' ? (categories[0]?.id ?? '') : selectedCategoryId,
    );
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductCategoryId(product.categoryId);
    setProductName(product.name);
    setProductDescription(product.description ?? '');
    setProductSortOrder(String(product.sortOrder));
    setProductErrors({});
    setDraftVariantErrors({});
    setProductActionError(null);
    setVariantProductId(null);
    setEditingVariantId(null);
    setVariantActionError(null);
  };

  const updateDraftVariant = (key: number, field: 'name' | 'priceFen', value: string): void => {
    setDraftVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, [field]: value } : variant)),
    );
    setDraftVariantErrors((current) => ({
      ...current,
      [key]: { ...current[key], [field]: undefined },
    }));
  };

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (productSubmitting) {
      return;
    }

    const trimmedName = productName.trim();
    const parsedSortOrder = parseSortOrderInput(productSortOrder);
    const nextErrors: { categoryId?: string; name?: string; sortOrder?: string } = {};
    if (!productCategoryId) {
      nextErrors.categoryId = '请选择商品分类';
    }
    if (!trimmedName) {
      nextErrors.name = '请输入商品名称';
    } else if (trimmedName.length > PRODUCT_NAME_MAX_LENGTH) {
      nextErrors.name = `商品名称不能超过${PRODUCT_NAME_MAX_LENGTH}个字符`;
    }
    if (parsedSortOrder === null) {
      nextErrors.sortOrder = '排序必须是整数';
    }

    const nextDraftErrors: Record<number, DraftVariantErrors> = {};
    if (!editingProductId) {
      for (const variant of draftVariants) {
        const errors: DraftVariantErrors = {};
        const variantName = variant.name.trim();
        if (!variantName) {
          errors.name = '请输入规格名称';
        } else if (variantName.length > VARIANT_NAME_MAX_LENGTH) {
          errors.name = `规格名称不能超过${VARIANT_NAME_MAX_LENGTH}个字符`;
        }
        if (parseFenInput(variant.priceFen) === null) {
          errors.priceFen = INVALID_PRICE_MESSAGE;
        }
        if (errors.name || errors.priceFen) {
          nextDraftErrors[variant.key] = errors;
        }
      }
    }

    if (
      nextErrors.categoryId ||
      nextErrors.name ||
      nextErrors.sortOrder ||
      Object.keys(nextDraftErrors).length > 0
    ) {
      setProductErrors(nextErrors);
      setDraftVariantErrors(nextDraftErrors);
      setProductActionError(null);
      return;
    }

    setProductErrors({});
    setDraftVariantErrors({});
    setProductActionError(null);
    setProductSubmitting(true);
    const description = productDescription.trim();
    try {
      const saved = editingProductId
        ? await updateProduct(accessToken, editingProductId, {
            categoryId: productCategoryId,
            name: trimmedName,
            description: description.length > 0 ? description : null,
            sortOrder: parsedSortOrder ?? 0,
          })
        : await createProduct(accessToken, {
            categoryId: productCategoryId,
            name: trimmedName,
            description: description.length > 0 ? description : null,
            sortOrder: parsedSortOrder ?? 0,
            variants: draftVariants.map((variant) => ({
              name: variant.name.trim(),
              priceFen: parseFenInput(variant.priceFen) ?? '0',
            })),
          });
      setProducts((current) =>
        sortProducts(
          editingProductId
            ? current.map((product) => (product.id === saved.id ? saved : product))
            : [...current, saved],
        ),
      );
      resetProductForm();
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setProductActionError(requestErrorMessage(error));
      }
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleProductStatus = async (product: Product) => {
    setBusyProductId(product.id);
    setProductActionError(null);
    try {
      const saved = await updateProduct(accessToken, product.id, {
        status: toggleStatus(product.status),
      });
      setProducts((current) =>
        sortProducts(current.map((entry) => (entry.id === saved.id ? saved : entry))),
      );
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setProductActionError(requestErrorMessage(error));
      }
    } finally {
      setBusyProductId(null);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    setBusyProductId(product.id);
    setProductActionError(null);
    try {
      await deleteProduct(accessToken, product.id);
      setProducts((current) => current.filter((entry) => entry.id !== product.id));
      if (editingProductId === product.id) {
        resetProductForm();
      }
      if (variantProductId === product.id) {
        setVariantProductId(null);
        setEditingVariantId(null);
      }
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setProductActionError(requestErrorMessage(error));
      }
    } finally {
      setBusyProductId(null);
    }
  };

  const resetVariantForm = (productId: string | null = null) => {
    setVariantProductId(productId);
    setEditingVariantId(null);
    setVariantName('');
    setVariantPriceFen('');
    setVariantSortOrder('0');
    setVariantErrors({});
    setVariantActionError(null);
  };

  const handleStartVariant = (product: Product, variant?: ProductVariant) => {
    setVariantProductId(product.id);
    setEditingVariantId(variant?.id ?? null);
    setVariantName(variant?.name ?? '');
    setVariantPriceFen(variant?.priceFen ?? '');
    setVariantSortOrder(String(variant?.sortOrder ?? 0));
    setVariantErrors({});
    setVariantActionError(null);
  };

  const handleVariantSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (variantSubmitting || !variantProductId) {
      return;
    }

    const trimmedName = variantName.trim();
    const normalizedPriceFen = parseFenInput(variantPriceFen);
    const parsedSortOrder = parseSortOrderInput(variantSortOrder);
    const nextErrors: VariantFormErrors = {};
    if (!trimmedName) {
      nextErrors.name = '请输入规格名称';
    } else if (trimmedName.length > VARIANT_NAME_MAX_LENGTH) {
      nextErrors.name = `规格名称不能超过${VARIANT_NAME_MAX_LENGTH}个字符`;
    }
    if (normalizedPriceFen === null) {
      nextErrors.priceFen = INVALID_PRICE_MESSAGE;
    }
    if (parsedSortOrder === null) {
      nextErrors.sortOrder = '排序必须是整数';
    }
    if (nextErrors.name || nextErrors.priceFen || nextErrors.sortOrder) {
      setVariantErrors(nextErrors);
      setVariantActionError(null);
      return;
    }

    setVariantErrors({});
    setVariantActionError(null);
    setVariantSubmitting(true);
    try {
      const saved = editingVariantId
        ? await updateVariant(accessToken, variantProductId, editingVariantId, {
            name: trimmedName,
            priceFen: normalizedPriceFen ?? '0',
            sortOrder: parsedSortOrder ?? 0,
          })
        : await createVariant(accessToken, variantProductId, {
            name: trimmedName,
            priceFen: normalizedPriceFen ?? '0',
            sortOrder: parsedSortOrder ?? 0,
          });
      setProducts((current) =>
        sortProducts(
          current.map((product) => {
            if (product.id !== variantProductId) {
              return product;
            }
            const variants = editingVariantId
              ? product.variants.map((variant) => (variant.id === saved.id ? saved : variant))
              : [...product.variants, saved];
            return { ...product, variants };
          }),
        ),
      );
      resetVariantForm();
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setVariantActionError(requestErrorMessage(error));
      }
    } finally {
      setVariantSubmitting(false);
    }
  };

  const handleVariantStatus = async (product: Product, variant: ProductVariant) => {
    setBusyVariantId(variant.id);
    setVariantActionError(null);
    try {
      const saved = await updateVariant(accessToken, product.id, variant.id, {
        status: toggleStatus(variant.status),
      });
      setProducts((current) =>
        sortProducts(
          current.map((entry) =>
            entry.id === product.id
              ? {
                  ...entry,
                  variants: entry.variants.map((item) => (item.id === saved.id ? saved : item)),
                }
              : entry,
          ),
        ),
      );
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setVariantActionError(requestErrorMessage(error));
      }
    } finally {
      setBusyVariantId(null);
    }
  };

  const handleDeleteVariant = async (product: Product, variant: ProductVariant) => {
    setBusyVariantId(variant.id);
    setVariantActionError(null);
    try {
      await deleteVariant(accessToken, product.id, variant.id);
      setProducts((current) =>
        current.map((entry) =>
          entry.id === product.id
            ? {
                ...entry,
                variants: entry.variants.filter((item) => item.id !== variant.id),
              }
            : entry,
        ),
      );
      if (editingVariantId === variant.id) {
        resetVariantForm();
      }
    } catch (error) {
      if (error instanceof UnauthorizedSessionError) {
        onSessionExpired();
      } else {
        setVariantActionError(
          requestErrorMessage(
            error,
            error instanceof MenuRequestError && error.code === 'VALIDATION_ERROR'
              ? LAST_VARIANT_MESSAGE
              : MENU_VALIDATION_MESSAGE,
          ),
        );
      }
    } finally {
      setBusyVariantId(null);
    }
  };

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <section className="tables-card menu-card" aria-labelledby="menu-title">
      <div className="tables-heading">
        <div>
          <span className="eyebrow">MENU MASTER DATA</span>
          <h2 id="menu-title">菜单管理</h2>
        </div>
        <p>
          {loading ? '正在加载…' : `共 ${categories.length} 个分类 / ${products.length} 个商品`}
        </p>
      </div>

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError ? (
        <>
          <section className="menu-section" aria-labelledby="categories-title">
            <div className="menu-section-heading">
              <div>
                <h3 id="categories-title">分类</h3>
                <p>停用分类仍会保留并占用名称。</p>
              </div>
            </div>

            {categoryActionError ? (
              <p className="form-error" role="alert">
                {categoryActionError}
              </p>
            ) : null}

            {categories.length === 0 ? (
              <p className="empty-state">暂无分类，请新建第一个分类。</p>
            ) : (
              <div className="table-scroll">
                <table className="tables-list" aria-label="分类列表">
                  <thead>
                    <tr>
                      <th scope="col">名称</th>
                      <th scope="col">排序</th>
                      <th scope="col">状态</th>
                      <th scope="col">更新时间</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td>{category.name}</td>
                        <td>{category.sortOrder}</td>
                        <td>
                          <span
                            className={`status-pill status-pill--${category.status.toLowerCase()}`}
                          >
                            {category.status === 'ACTIVE' ? '启用中' : '已停用'}
                          </span>
                        </td>
                        <td className="table-time">{category.updatedAt}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="text-button"
                              type="button"
                              aria-label={`编辑分类 ${category.name}`}
                              onClick={() => handleEditCategory(category)}
                            >
                              编辑
                            </button>
                            <button
                              className="text-button"
                              type="button"
                              aria-label={`${category.status === 'ACTIVE' ? '停用' : '启用'}分类 ${category.name}`}
                              onClick={() => void handleCategoryStatus(category)}
                            >
                              {category.status === 'ACTIVE' ? '停用' : '启用'}
                            </button>
                            <button
                              className="text-button text-button--danger"
                              type="button"
                              aria-label={`删除分类 ${category.name}`}
                              onClick={() => void handleDeleteCategory(category)}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form className="table-form menu-form" noValidate onSubmit={handleCategorySubmit}>
              <div className="table-form-heading">
                <h3>{editingCategoryId ? '编辑分类' : '新建分类'}</h3>
                {editingCategoryId ? (
                  <button className="text-button" type="button" onClick={resetCategoryForm}>
                    取消编辑
                  </button>
                ) : null}
              </div>
              <div className="table-form-fields menu-form-fields">
                <div className="form-field">
                  <label htmlFor="category-name">分类名称</label>
                  <input
                    id="category-name"
                    type="text"
                    maxLength={CATEGORY_NAME_MAX_LENGTH}
                    value={categoryName}
                    aria-invalid={Boolean(categoryErrors.name)}
                    aria-describedby={categoryErrors.name ? 'category-name-error' : undefined}
                    onChange={(event) => {
                      setCategoryName(event.target.value);
                      setCategoryErrors((current) => ({ ...current, name: undefined }));
                    }}
                  />
                  {categoryErrors.name ? (
                    <p className="field-error" id="category-name-error" role="alert">
                      {categoryErrors.name}
                    </p>
                  ) : null}
                </div>
                <div className="form-field">
                  <label htmlFor="category-sort">分类排序</label>
                  <input
                    id="category-sort"
                    type="number"
                    step="1"
                    value={categorySortOrder}
                    aria-invalid={Boolean(categoryErrors.sortOrder)}
                    onChange={(event) => {
                      setCategorySortOrder(event.target.value);
                      setCategoryErrors((current) => ({ ...current, sortOrder: undefined }));
                    }}
                  />
                  {categoryErrors.sortOrder ? (
                    <p className="field-error" role="alert">
                      {categoryErrors.sortOrder}
                    </p>
                  ) : null}
                </div>
                <div className="form-field">
                  <label htmlFor="category-status">分类状态</label>
                  <select
                    id="category-status"
                    value={categoryStatus}
                    onChange={(event) => setCategoryStatus(event.target.value as MenuStatus)}
                  >
                    <option value="ACTIVE">启用</option>
                    <option value="DISABLED">停用</option>
                  </select>
                </div>
              </div>
              <button
                className="primary-button table-submit"
                type="submit"
                disabled={categorySubmitting}
              >
                {categorySubmitting ? '保存中…' : editingCategoryId ? '保存分类' : '新建分类'}
              </button>
            </form>
          </section>

          <section className="menu-section" aria-labelledby="products-title">
            <div className="menu-section-heading menu-section-heading--products">
              <div>
                <h3 id="products-title">商品与规格</h3>
                <p>价格以整数分保存，界面按元展示。</p>
              </div>
              <div className="form-field menu-filter">
                <label htmlFor="product-category-filter">按分类查看</label>
                <select
                  id="product-category-filter"
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
                >
                  <option value="all">全部分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {productActionError ? (
              <p className="form-error" role="alert">
                {productActionError}
              </p>
            ) : null}
            {variantActionError ? (
              <p className="form-error" role="alert">
                {variantActionError}
              </p>
            ) : null}

            {visibleProducts.length === 0 ? (
              <p className="empty-state">该分类下暂无商品。</p>
            ) : (
              <div className="product-list">
                {visibleProducts.map((product) => (
                  <article
                    className="product-card"
                    key={product.id}
                    aria-labelledby={`product-${product.id}`}
                  >
                    <div className="product-card-heading">
                      <div>
                        <h4 id={`product-${product.id}`}>{product.name}</h4>
                        <p className="product-meta">
                          {categoryNameById.get(product.categoryId) ?? product.categoryId}
                          <span aria-hidden="true"> · </span>
                          排序 {product.sortOrder}
                        </p>
                      </div>
                      <span className={`status-pill status-pill--${product.status.toLowerCase()}`}>
                        {product.status === 'ACTIVE' ? '启用中' : '已停用'}
                      </span>
                    </div>
                    {product.description ? (
                      <p className="product-description">{product.description}</p>
                    ) : null}
                    <p className="table-time">更新时间：{product.updatedAt}</p>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        type="button"
                        aria-label={`编辑商品 ${product.name}`}
                        onClick={() => handleEditProduct(product)}
                      >
                        编辑
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        aria-label={`${product.status === 'ACTIVE' ? '停用' : '启用'}商品 ${product.name}`}
                        disabled={busyProductId === product.id}
                        onClick={() => void handleProductStatus(product)}
                      >
                        {product.status === 'ACTIVE' ? '停用' : '启用'}
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        aria-label={`为 ${product.name} 新增规格`}
                        onClick={() => handleStartVariant(product)}
                      >
                        新增规格
                      </button>
                      <button
                        className="text-button text-button--danger"
                        type="button"
                        aria-label={`删除商品 ${product.name}`}
                        disabled={busyProductId === product.id}
                        onClick={() => void handleDeleteProduct(product)}
                      >
                        删除
                      </button>
                    </div>

                    <div className="table-scroll">
                      <table
                        className="tables-list variants-list"
                        aria-label={`${product.name}规格列表`}
                      >
                        <thead>
                          <tr>
                            <th scope="col">规格</th>
                            <th scope="col">价格</th>
                            <th scope="col">状态</th>
                            <th scope="col">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.variants.map((variant) => (
                            <tr key={variant.id}>
                              <td>{variant.name}</td>
                              <td>
                                <span className="price-value">
                                  ¥{formatFenAsYuan(variant.priceFen)}
                                </span>
                                <span className="price-fen">（{variant.priceFen} 分）</span>
                              </td>
                              <td>
                                <span
                                  className={`status-pill status-pill--${variant.status.toLowerCase()}`}
                                >
                                  {variant.status === 'ACTIVE' ? '启用中' : '已停用'}
                                </span>
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="text-button"
                                    type="button"
                                    aria-label={`编辑规格 ${variant.name}`}
                                    onClick={() => handleStartVariant(product, variant)}
                                  >
                                    编辑
                                  </button>
                                  <button
                                    className="text-button"
                                    type="button"
                                    aria-label={`${variant.status === 'ACTIVE' ? '停用' : '启用'}规格 ${variant.name}`}
                                    disabled={busyVariantId === variant.id}
                                    onClick={() => void handleVariantStatus(product, variant)}
                                  >
                                    {variant.status === 'ACTIVE' ? '停用' : '启用'}
                                  </button>
                                  <button
                                    className="text-button text-button--danger"
                                    type="button"
                                    aria-label={`删除规格 ${variant.name}`}
                                    disabled={busyVariantId === variant.id}
                                    onClick={() => void handleDeleteVariant(product, variant)}
                                  >
                                    删除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {variantProductId ? (
              <form className="table-form menu-form" noValidate onSubmit={handleVariantSubmit}>
                <div className="table-form-heading">
                  <h3>{editingVariantId ? '编辑规格' : '新增规格'}</h3>
                  <button className="text-button" type="button" onClick={() => resetVariantForm()}>
                    取消
                  </button>
                </div>
                <div className="table-form-fields">
                  <div className="form-field">
                    <label htmlFor="variant-name">规格名称</label>
                    <input
                      id="variant-name"
                      type="text"
                      maxLength={VARIANT_NAME_MAX_LENGTH}
                      value={variantName}
                      aria-invalid={Boolean(variantErrors.name)}
                      onChange={(event) => {
                        setVariantName(event.target.value);
                        setVariantErrors((current) => ({ ...current, name: undefined }));
                      }}
                    />
                    {variantErrors.name ? (
                      <p className="field-error" role="alert">
                        {variantErrors.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="form-field">
                    <label htmlFor="variant-price">规格价格（分）</label>
                    <input
                      id="variant-price"
                      type="text"
                      inputMode="numeric"
                      value={variantPriceFen}
                      aria-invalid={Boolean(variantErrors.priceFen)}
                      onChange={(event) => {
                        setVariantPriceFen(event.target.value);
                        setVariantErrors((current) => ({ ...current, priceFen: undefined }));
                      }}
                    />
                    <p className="field-hint">展示为 ¥{formatFenAsYuan(variantPriceFen || '0')}</p>
                    {variantErrors.priceFen ? (
                      <p className="field-error" role="alert">
                        {variantErrors.priceFen}
                      </p>
                    ) : null}
                  </div>
                  <div className="form-field">
                    <label htmlFor="variant-sort">规格排序</label>
                    <input
                      id="variant-sort"
                      type="number"
                      step="1"
                      value={variantSortOrder}
                      onChange={(event) => setVariantSortOrder(event.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="primary-button table-submit"
                  type="submit"
                  disabled={variantSubmitting}
                >
                  {variantSubmitting ? '保存中…' : editingVariantId ? '保存规格' : '新增规格'}
                </button>
              </form>
            ) : null}

            <form className="table-form menu-form" noValidate onSubmit={handleProductSubmit}>
              <div className="table-form-heading">
                <h3>{editingProductId ? '编辑商品' : '新建商品'}</h3>
                {editingProductId ? (
                  <button className="text-button" type="button" onClick={resetProductForm}>
                    取消编辑
                  </button>
                ) : null}
              </div>
              <div className="table-form-fields menu-form-fields">
                <div className="form-field">
                  <label htmlFor="product-category">商品分类</label>
                  <select
                    id="product-category"
                    value={productCategoryId}
                    aria-invalid={Boolean(productErrors.categoryId)}
                    onChange={(event) => {
                      setProductCategoryId(event.target.value);
                      setProductErrors((current) => ({ ...current, categoryId: undefined }));
                    }}
                  >
                    <option value="">请选择分类</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {productErrors.categoryId ? (
                    <p className="field-error" role="alert">
                      {productErrors.categoryId}
                    </p>
                  ) : null}
                </div>
                <div className="form-field">
                  <label htmlFor="product-name">商品名称</label>
                  <input
                    id="product-name"
                    type="text"
                    maxLength={PRODUCT_NAME_MAX_LENGTH}
                    value={productName}
                    aria-invalid={Boolean(productErrors.name)}
                    onChange={(event) => {
                      setProductName(event.target.value);
                      setProductErrors((current) => ({ ...current, name: undefined }));
                    }}
                  />
                  {productErrors.name ? (
                    <p className="field-error" role="alert">
                      {productErrors.name}
                    </p>
                  ) : null}
                </div>
                <div className="form-field form-field--wide">
                  <label htmlFor="product-description">商品说明</label>
                  <textarea
                    id="product-description"
                    rows={2}
                    value={productDescription}
                    onChange={(event) => setProductDescription(event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="product-sort">商品排序</label>
                  <input
                    id="product-sort"
                    type="number"
                    step="1"
                    value={productSortOrder}
                    aria-invalid={Boolean(productErrors.sortOrder)}
                    onChange={(event) => {
                      setProductSortOrder(event.target.value);
                      setProductErrors((current) => ({ ...current, sortOrder: undefined }));
                    }}
                  />
                  {productErrors.sortOrder ? (
                    <p className="field-error" role="alert">
                      {productErrors.sortOrder}
                    </p>
                  ) : null}
                </div>
              </div>

              {!editingProductId ? (
                <div className="draft-variants">
                  <div className="table-form-heading">
                    <h4>规格（至少一条）</h4>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        setDraftVariants((current) => [...current, createDraftVariant()])
                      }
                    >
                      增加规格
                    </button>
                  </div>
                  {draftVariants.map((variant, index) => {
                    const errors = draftVariantErrors[variant.key] ?? {};
                    return (
                      <div className="draft-variant-row" key={variant.key}>
                        <div className="form-field">
                          <label htmlFor={`draft-variant-name-${variant.key}`}>
                            第{index + 1}个规格名称
                          </label>
                          <input
                            id={`draft-variant-name-${variant.key}`}
                            type="text"
                            maxLength={VARIANT_NAME_MAX_LENGTH}
                            value={variant.name}
                            aria-invalid={Boolean(errors.name)}
                            onChange={(event) =>
                              updateDraftVariant(variant.key, 'name', event.target.value)
                            }
                          />
                          {errors.name ? (
                            <p className="field-error" role="alert">
                              {errors.name}
                            </p>
                          ) : null}
                        </div>
                        <div className="form-field">
                          <label htmlFor={`draft-variant-price-${variant.key}`}>
                            第{index + 1}个规格价格（分）
                          </label>
                          <input
                            id={`draft-variant-price-${variant.key}`}
                            type="text"
                            inputMode="numeric"
                            value={variant.priceFen}
                            aria-invalid={Boolean(errors.priceFen)}
                            onChange={(event) =>
                              updateDraftVariant(variant.key, 'priceFen', event.target.value)
                            }
                          />
                          <p className="field-hint">
                            展示为 ¥{formatFenAsYuan(variant.priceFen || '0')}
                          </p>
                          {errors.priceFen ? (
                            <p className="field-error" role="alert">
                              {errors.priceFen}
                            </p>
                          ) : null}
                        </div>
                        <button
                          className="text-button text-button--danger"
                          type="button"
                          aria-label={`移除第${index + 1}个规格`}
                          disabled={draftVariants.length <= 1}
                          onClick={() =>
                            setDraftVariants((current) =>
                              current.filter((entry) => entry.key !== variant.key),
                            )
                          }
                        >
                          移除
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <button
                className="primary-button table-submit"
                type="submit"
                disabled={productSubmitting}
              >
                {productSubmitting ? '保存中…' : editingProductId ? '保存商品' : '新建商品'}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </section>
  );
}
