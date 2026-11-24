import { describe, expect, it } from 'vitest';

import {
  addCartItem,
  cartItemCount,
  cartSignature,
  cartTotalFen,
  setCartQuantity,
} from '../src/utils/cart';

describe('cart calculations', () => {
  it('adds variants, merges duplicate variants, and caps quantity at 99', () => {
    const first = addCartItem([], {
      variantId: '11',
      productName: '桂花乌龙',
      variantName: '大杯',
      unitPriceFen: '2300',
    });
    const second = addCartItem(first, {
      variantId: '11',
      productName: '桂花乌龙',
      variantName: '大杯',
      unitPriceFen: '2300',
      quantity: 98,
    });

    expect(second).toEqual([
      {
        variantId: '11',
        productName: '桂花乌龙',
        variantName: '大杯',
        unitPriceFen: '2300',
        quantity: 99,
      },
    ]);
  });

  it('calculates integer-fen totals and formatted display amounts', () => {
    const lines = [
      {
        variantId: '11',
        productName: '桂花乌龙',
        variantName: '大杯',
        unitPriceFen: '2300',
        quantity: 2,
      },
      {
        variantId: '12',
        productName: '桂花乌龙',
        variantName: '标准杯',
        unitPriceFen: '1200',
        quantity: 1,
      },
    ];

    expect(cartTotalFen(lines)).toBe('5800');
    expect(cartItemCount(lines)).toBe(3);
  });

  it('updates or removes quantities and creates an order-independent signature', () => {
    const lines = [
      {
        variantId: '12',
        productName: '标准杯',
        variantName: '标准杯',
        unitPriceFen: '1200',
        quantity: 1,
      },
      {
        variantId: '11',
        productName: '大杯',
        variantName: '大杯',
        unitPriceFen: '2300',
        quantity: 2,
      },
    ];
    expect(cartSignature(lines)).toBe('11:2|12:1');
    expect(cartSignature([...lines].reverse())).toBe('11:2|12:1');
    expect(setCartQuantity(lines, '12', 4).find((line) => line.variantId === '12')?.quantity).toBe(
      4,
    );
    expect(setCartQuantity(lines, '12', 0).some((line) => line.variantId === '12')).toBe(false);
  });
});
