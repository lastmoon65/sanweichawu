const FEN_PATTERN = /^\d+$/;

export function normalizeFen(value: string | number): string {
  const text = String(value).trim();
  if (!FEN_PATTERN.test(text)) {
    throw new RangeError('金额必须是非负整数分');
  }
  return text.replace(/^0+(?=\d)/, '');
}

export function addFen(left: string | number, right: string | number): string {
  const a = normalizeFen(left);
  const b = normalizeFen(right);
  let carry = 0;
  let indexA = a.length - 1;
  let indexB = b.length - 1;
  let result = '';
  while (indexA >= 0 || indexB >= 0 || carry > 0) {
    const digitA = indexA >= 0 ? Number(a[indexA]) : 0;
    const digitB = indexB >= 0 ? Number(b[indexB]) : 0;
    const total = digitA + digitB + carry;
    result = String(total % 10) + result;
    carry = Math.floor(total / 10);
    indexA -= 1;
    indexB -= 1;
  }
  return normalizeFen(result);
}

export function multiplyFen(fen: string | number, quantity: number): string {
  const amount = normalizeFen(fen);
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError('数量必须是非负整数');
  }
  if (quantity === 0 || amount === '0') {
    return '0';
  }
  let carry = 0;
  let result = '';
  for (let index = amount.length - 1; index >= 0; index -= 1) {
    const product = Number(amount[index]) * quantity + carry;
    result = String(product % 10) + result;
    carry = Math.floor(product / 10);
  }
  while (carry > 0) {
    result = String(carry % 10) + result;
    carry = Math.floor(carry / 10);
  }
  return normalizeFen(result);
}

export function formatFen(value: string | number): string {
  const normalized = normalizeFen(value);
  const padded = normalized.padStart(3, '0');
  const cents = padded.slice(-2);
  const yuan = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  return `${yuan}.${cents}`;
}
