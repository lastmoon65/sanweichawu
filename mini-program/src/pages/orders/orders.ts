import type { CustomerOrder } from '../../services/customer-api';
import { createWxCustomerApi } from '../../services/wx-adapter';
import { formatShanghaiDateTime, formatOrderStatus } from '../../utils/datetime';
import { customerFacingError } from '../../utils/friendly-error';
import { formatFen } from '../../utils/money';

const api = createWxCustomerApi();

interface OrderView {
  readonly id: string;
  readonly orderNo: string;
  readonly status: CustomerOrder['status'];
  readonly statusText: string;
  readonly version: number;
  readonly totalDisplay: string;
  readonly createdAtDisplay: string;
  readonly canCancel: boolean;
  readonly items: Array<{
    readonly id: string;
    readonly name: string;
    readonly quantity: number;
    readonly lineSubtotalDisplay: string;
    readonly remark: string | null;
  }>;
}

interface OrdersPageData {
  sessionId: string;
  orders: OrderView[];
  loading: boolean;
  error: string;
}

Page<OrdersPageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    sessionId: '',
    orders: [],
    loading: true,
    error: '',
  },

  async onLoad(options: Record<string, string | undefined>): Promise<void> {
    this.setData({ sessionId: options.sessionId ?? '' });
    await this.loadOrders();
  },

  async onPullDownRefresh(): Promise<void> {
    await this.loadOrders();
    wx.stopPullDownRefresh();
  },

  async loadOrders(): Promise<void> {
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.listOrders(this.data.sessionId || undefined);
      this.setData({
        orders: result.items.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          statusText: formatOrderStatus(order.status),
          version: order.version,
          totalDisplay: formatFen(order.totalAmountFen),
          createdAtDisplay: formatShanghaiDateTime(order.createdAt),
          canCancel: order.status === 'PENDING_ACCEPTANCE',
          items: order.items.map((item) => ({
            id: item.id,
            name: `${item.productNameSnapshot} · ${item.variantNameSnapshot}`,
            quantity: item.quantity,
            lineSubtotalDisplay: formatFen(item.lineSubtotalFen),
            remark: item.remark,
          })),
        })),
      });
    } catch (error) {
      this.setData({ error: customerFacingError(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  confirmCancel(event: {
    currentTarget: { dataset: { orderId?: string; version?: number | string } };
  }): void {
    const orderId = event.currentTarget.dataset.orderId;
    const version = Number(event.currentTarget.dataset.version ?? 0);
    if (!orderId || version < 1) {
      return;
    }
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？取消后不可恢复。',
      confirmText: '确认取消',
      cancelText: '再想想',
      success: (result) => {
        if (result.confirm) {
          void this.cancelOrder(orderId, version);
        }
      },
    });
  },

  async cancelOrder(orderId: string, version: number): Promise<void> {
    this.setData({ error: '' });
    try {
      await api.cancelOrder(orderId, version, '顾客取消');
      wx.showToast({ title: '订单已取消', icon: 'success' });
      await this.loadOrders();
    } catch (error) {
      this.setData({ error: customerFacingError(error) });
    }
  },

  goMenu(): void {
    const query = this.data.sessionId
      ? `?sessionId=${encodeURIComponent(this.data.sessionId)}`
      : '';
    wx.navigateTo({ url: `/pages/menu/menu${query}` });
  },
});
