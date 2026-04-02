export interface SalaryPayout {
  id: string;
  userId: string;
  userEmail: string;
  payoutDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
}

export interface CreateSalaryPayoutPayload {
  userId: string;
  userEmail: string;
  payoutDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
}

