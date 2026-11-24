const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function formatShanghaiDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_ACCEPTANCE: '待接单',
  ACCEPTED: '已接单',
  PREPARING: '制作中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? '状态未知';
}
