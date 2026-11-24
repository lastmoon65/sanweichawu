const SHANGHAI_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function formatDateTime(value: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = SHANGHAI_TIME_FORMATTER.formatToParts(date);
  const year = partValue(parts, 'year');
  const month = partValue(parts, 'month');
  const day = partValue(parts, 'day');
  const hour = partValue(parts, 'hour');
  const minute = partValue(parts, 'minute');
  if (!year || !month || !day || !hour || !minute) {
    return value;
  }
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
