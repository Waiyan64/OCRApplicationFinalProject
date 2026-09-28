export class ProfileDto {
    name!: string;
    premiumDaysLeft!: number;
    role!: 'free' | 'subscribed' | 'admin';
}

export class SummaryDto {
    cashIn!: number;
    cashOut!: number;
    currency!: string;
}

export class TransactionDto {
    id!: string;
    walletApp!: string;
    type!: 'cash_in' | 'cash_out';
    amount!: number;
    balance!: number;
    currency!: string;
    timestamp!: string;
}
