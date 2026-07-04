export interface SavedPrintListing {
  id: string;
  portfolioEntryId: string;
  shootId?: string | null;
  imageUrl?: string | null;
  orphaned?: boolean;
  marketplace: string;
  title: string;
  description: string;
  listPrice: number;
  currency: string;
  status: string;
  listedAt: string | null;
  createdAt: string | null;
}

export interface PrintSalesListResponse {
  items: SavedPrintListing[];
  total: number;
}
