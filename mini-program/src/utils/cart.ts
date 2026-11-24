import { addFen, multiplyFen, normalizeFen } from './money';

export interface CartLine {
  readonly variantId: string;
  readonly productName: string;
  readonly variantName: string;
  readonly unitPriceFen: string;
  readonly quantity: number;
}

export interface AddCartItem {
  readonly variantId: string;
  readonly productName: string;
  readonly variantName: string;
  readonly unitPriceFen: string;
  readonly quantity?: number;
}

const MAX_QUANTITY = 99;

export function addCartItem(lines: readonly CartLine[], item: AddCartItem): CartLine[] {
  const increment = item.quantity ?? 1;
  if (!Number.isInteger(increment) || increment < 1 || increment > MAX_QUANTITY) {
    throw new RangeError('加购数量必须是 1 到 99 的整数');
  }
  const normalizedPrice = normalizeFen(item.unitPriceFen);
  const existingIndex = lines.findIndex((line) => line.variantId === item.variantId);
  if (existingIndex < 0) {
    return [
      ...lines,
      {
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        unitPriceFen: normalizedPrice,
        quantity: increment,
      },
    ];
  }
  return lines.map((line, index) =>
    index === existingIndex
      ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + increment) }
      : line,
  );
}

export function setCartQuantity(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
): CartLine[] {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return lines.filter((line) => line.variantId !== variantId);
  }
  return lines.map((line) =>
    line.variantId === variantId ? { ...line, quantity: Math.min(MAX_QUANTITY, quantity) } : line,
  );
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartTotalFen(lines: readonly CartLine[]): string {
  return lines.reduce(
    (total, line) => addFen(total, multiplyFen(line.unitPriceFen, line.quantity)),
    '0',
  );
}

export function cartSignature(lines: readonly CartLine[]): string {
  return [...lines]
    .sort((left, right) =>
      left.variantId === right.variantId ? 0 : left.variantId < right.variantId ? -1 : 1,
    )
    .map((line) => `${line.variantId}:${line.quantity}`)
    .join('|');
}
