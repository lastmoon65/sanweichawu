export const API_PREFIX = 'api/v1';
export const REQUEST_ID_HEADER = 'x-request-id';

export interface ApiSuccessBody<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
  requestId: string;
}
