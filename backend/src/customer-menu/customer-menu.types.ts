export interface CustomerTableResponse {
  readonly storeId: string;
  readonly table: {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  };
  readonly session: {
    readonly id: string;
    readonly openedAt: string;
  };
}

export interface CustomerVariantResponse {
  readonly id: string;
  readonly name: string;
  readonly priceFen: string;
  readonly sortOrder: number;
}

export interface CustomerProductResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  readonly variants: CustomerVariantResponse[];
}

export interface CustomerCategoryResponse {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly products: CustomerProductResponse[];
}

export interface CustomerMenuResponse {
  readonly storeId: string;
  readonly sessionId: string;
  readonly categories: CustomerCategoryResponse[];
}
