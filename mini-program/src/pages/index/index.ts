import { CUSTOMER_TABLE_STORAGE_KEY } from '../../config';
import { createWxCustomerApi } from '../../services/wx-adapter';
import { customerFacingError } from '../../utils/friendly-error';
import { parseTableCode } from '../../utils/table-code';

const api = createWxCustomerApi();

Page({
  data: {
    tableCodeInput: '',
    loading: false,
    loggingIn: true,
    error: '',
  },

  async onLoad(): Promise<void> {
    try {
      await api.login();
    } catch (error) {
      this.setData({ error: customerFacingError(error) });
    } finally {
      this.setData({ loggingIn: false });
    }
  },

  onCodeInput(event: { detail: { value: string } }): void {
    this.setData({ tableCodeInput: event.detail.value, error: '' });
  },

  onScan(): void {
    this.setData({ error: '' });
    wx.scanCode({
      scanType: ['qrCode'],
      success: (result) => {
        const code = parseTableCode(result.result);
        if (!code) {
          this.setData({ error: '未识别到有效桌码，请重试或手动输入' });
          return;
        }
        void this.resolveTable(code);
      },
      fail: () => {
        this.setData({ error: '扫码已取消，请重试或手动输入桌码' });
      },
    });
  },

  onManualResolve(): void {
    const code = parseTableCode(this.data.tableCodeInput);
    if (!code) {
      this.setData({ error: '请输入正确的桌码' });
      return;
    }
    void this.resolveTable(code);
  },

  async resolveTable(code: string): Promise<void> {
    if (this.data.loading) {
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const table = await api.resolveTable(code);
      wx.setStorageSync(CUSTOMER_TABLE_STORAGE_KEY, table);
      wx.navigateTo({
        url: `/pages/menu/menu?sessionId=${encodeURIComponent(table.session.id)}&tableCode=${encodeURIComponent(table.table.code)}`,
      });
    } catch (error) {
      this.setData({ error: customerFacingError(error) });
    } finally {
      this.setData({ loading: false });
    }
  },
});
