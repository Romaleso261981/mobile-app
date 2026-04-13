export interface SalaryPayout {
  id: string;
  companyId: string;
  userId: string;
  userEmail: string;
  payoutDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
}

export interface CreateSalaryPayoutPayload {
  companyId: string;
  userId: string;
  userEmail: string;
  payoutDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
}

