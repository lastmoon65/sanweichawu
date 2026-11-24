import { CUSTOMER_TOKEN_STORAGE_KEY } from '../config';
import { ApiClient } from './api-client';
import type {
  ApiRequestOptions,
  ApiRequestResult,
  ApiRequester,
  LoginCodeProvider,
  TokenStorage,
} from './api-client';
import { CustomerApi } from './customer-api';

export const wxTokenStorage: TokenStorage = {
  read(): string | undefined {
    const value = wx.getStorageSync(CUSTOMER_TOKEN_STORAGE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  },
  write(token: string): void {
    wx.setStorageSync(CUSTOMER_TOKEN_STORAGE_KEY, token);
  },
  clear(): void {
    wx.removeStorageSync(CUSTOMER_TOKEN_STORAGE_KEY);
  },
};

export const wxLoginCode: LoginCodeProvider = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: (result) => {
        if (result.code) {
          resolve(result.code);
        } else {
          reject(new Error('微信登录未返回 code'));
        }
      },
      fail: reject,
    });
  });

export const wxRequester: ApiRequester = (options: ApiRequestOptions) =>
  new Promise<ApiRequestResult>((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method,
      header: options.headers,
      data: options.data as WechatMiniprogram.IAnyObject | string | ArrayBuffer | undefined,
      success: (result) => resolve({ statusCode: result.statusCode, data: result.data }),
      fail: reject,
    });
  });

export function createWxCustomerApi(): CustomerApi {
  return new CustomerApi(
    new ApiClient({ requester: wxRequester, loginCode: wxLoginCode, storage: wxTokenStorage }),
  );
}
