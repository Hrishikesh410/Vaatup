export type CategoryId = string;

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
  sortOrder: number;
  isBuiltin: boolean;
}

/** Used when an expense is created without the user choosing a category. */
export const DEFAULT_CATEGORY_ID: CategoryId = 'other';
