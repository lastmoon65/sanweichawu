import { ApiError } from '../../services/api-client';
import type { MenuCategory, MenuProduct, MenuVariant } from '../../services/customer-api';
import { createWxCustomerApi } from '../../services/wx-adapter';
import {
  addCartItem,
  cartItemCount,
  cartSignature,
  cartTotalFen,
  setCartQuantity,
} from '../../utils/cart';
import type { CartLine } from '../../utils/cart';
import { customerFacingError } from '../../utils/friendly-error';
import { generateIdempotencyKey, resolvePendingIdempotency } from '../../utils/idempotency';
import { formatFen, multiplyFen } from '../../utils/money';

const api = createWxCustomerApi();

interface VariantView extends MenuVariant {
  readonly priceDisplay: string;
}

interface ProductView extends Omit<MenuProduct, 'variants'> {
  readonly variants: VariantView[];
}

interface CategoryView extends Omit<MenuCategory, 'products'> {
  readonly products: ProductView[];
}

interface CartLineView extends CartLine {
  readonly priceDisplay: string;
  readonly lineTotalDisplay: string;
}

interface MenuPageData {
  sessionId: string;
  tableCode: string;
  categories: CategoryView[];
  activeCategoryIndex: number;
  activeProducts: ProductView[];
  cart: CartLineView[];
  cartCount: number;
  totalFen: string;
  totalDisplay: string;
  pendingKey: string;
  pendingSignature: string;
  loading: boolean;
  submitting: boolean;
  error: string;
}

function categoryProducts(categories: readonly CategoryView[], index: number): ProductView[] {
  return categories[index]?.products ?? [];
}

function cartViews(lines: readonly CartLine[]): CartLineView[] {
  return lines.map((line) => ({
    ...line,
    priceDisplay: formatFen(line.unitPriceFen),
    lineTotalDisplay: formatFen(multiplyFen(line.unitPriceFen, line.quantity)),
  }));
}

Page<MenuPageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    sessionId: '',
    tableCode: '',
    categories: [],
    activeCategoryIndex: 0,
    activeProducts: [],
    cart: [],
    cartCount: 0,
    totalFen: '0',
    totalDisplay: '0.00',
    pendingKey: '',
    pendingSignature: '',
    loading: true,
    submitting: false,
    error: '',
  },

  async onLoad(options: Record<string, string | undefined>): Promise<void> {
    const sessionId = options.sessionId ?? '';
    let tableCode = options.tableCode ?? '';
    try {
      tableCode = tableCode ? decodeURIComponent(tableCode) : '';
    } catch {
      tableCode = options.tableCode ?? '';
    }
    this.setData({ sessionId, tableCode });
    if (!sessionId) {
      this.setData({ loading: false, error: '桌台信息缺失，请重新扫码' });
      return;
    }
    await this.loadMenu();
  },

  async loadMenu(): Promise<void> {
    this.setData({ loading: true, error: '' });
    try {
      const menu = await api.getMenu(this.data.sessionId);
      const categories: CategoryView[] = menu.categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          sortOrder: product.sortOrder,
          variants: product.variants.map((variant) => ({
            ...variant,
            priceDisplay: formatFen(variant.priceFen),
          })),
        })),
      }));
      this.setData({
        categories,
        activeCategoryIndex: 0,
        activeProducts: categoryProducts(categories, 0),
      });
    } catch (error) {
      this.setData({ error: customerFacingError(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectCategory(event: { currentTarget: { dataset: { index?: number | string } } }): void {
    const index = Number(event.currentTarget.dataset.index ?? 0);
    this.setData({
      activeCategoryIndex: index,
      activeProducts: categoryProducts(this.data.categories, index),
    });
  },

  addVariant(event: {
    currentTarget: {
      dataset: {
        variantId?: string;
        variantName?: string;
        productName?: string;
        priceFen?: string;
      };
    };
  }): void {
    const dataset = event.currentTarget.dataset;
    if (!dataset.variantId || !dataset.variantName || !dataset.productName || !dataset.priceFen) {
      return;
    }
    const cart = addCartItem(this.data.cart, {
      variantId: dataset.variantId,
      variantName: dataset.variantName,
      productName: dataset.productName,
      unitPriceFen: dataset.priceFen,
    });
    this.syncCart(cart);
  },

  changeQuantity(event: {
    currentTarget: { dataset: { variantId?: string; delta?: number | string } };
  }): void {
    const dataset = event.currentTarget.dataset;
    const line = this.data.cart.find((entry) => entry.variantId === dataset.variantId);
    if (!line || dataset.variantId === undefined) {
      return;
    }
    const delta = Number(dataset.delta ?? 0);
    this.syncCart(setCartQuantity(this.data.cart, dataset.variantId, line.quantity + delta));
  },

  syncCart(cart: CartLine[]): void {
    const totalFen = cartTotalFen(cart);
    this.setData({
      cart: cartViews(cart),
      cartCount: cartItemCount(cart),
      totalFen,
      totalDisplay: formatFen(totalFen),
    });
  },

  async submitOrder(): Promise<void> {
    if (this.data.submitting || this.data.cart.length === 0) {
      return;
    }
    const signature = `${this.data.sessionId}|${cartSignature(this.data.cart)}`;
    const pending = resolvePendingIdempotency(
      this.data.pendingKey
        ? { key: this.data.pendingKey, signature: this.data.pendingSignature }
        : undefined,
      signature,
      generateIdempotencyKey,
    );
    this.setData({
      submitting: true,
      error: '',
      pendingKey: pending.key,
      pendingSignature: pending.signature,
    });
    try {
      await api.createOrder(
        this.data.sessionId,
        this.data.cart.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
        })),
        pending.key,
      );
      this.setData({
        cart: [],
        cartCount: 0,
        totalFen: '0',
        totalDisplay: '0.00',
        pendingKey: '',
        pendingSignature: '',
      });
      wx.showToast({ title: '下单成功', icon: 'success' });
      setTimeout(() => {
        this.openOrders();
      }, 500);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        this.setData({ pendingKey: '', pendingSignature: '' });
      }
      this.setData({ error: customerFacingError(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openOrders(): void {
    wx.navigateTo({
      url: `/pages/orders/orders?sessionId=${encodeURIComponent(this.data.sessionId)}`,
    });
  },

  goOrders(): void {
    this.openOrders();
  },
});
