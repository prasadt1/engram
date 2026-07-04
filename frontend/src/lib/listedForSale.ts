export const LISTED_FOR_SALE_TAG = 'listed_for_sale';

export function isListedForSale(userTags: string[] | undefined): boolean {
  return (userTags ?? []).includes(LISTED_FOR_SALE_TAG);
}

export function listedForSaleLabel(): string {
  return 'Listed for sale';
}
