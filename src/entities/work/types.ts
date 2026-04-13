export interface WorkEntry {
  id: string;
  companyId: string;
  userId: string;
  userEmail: string;
  workDate: string; // YYYY-MM-DD
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
}

export interface CreateWorkEntryPayload {
  companyId: string;
  userId: string;
  userEmail: string;
  workDate: string; // YYYY-MM-DD
  description: string;
  categoryId: string;
  categoryName: string;
  amount?: number;
}

