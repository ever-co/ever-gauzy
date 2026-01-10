export type BillingPeriodKey = 'monthly' | 'quarterly' | 'yearly';

export interface BillingOption {
	period: BillingPeriodKey;
	label: string;
	description: string;
	price: number;
	badge?: { text: string; status: 'primary' | 'success' | 'warning' | 'info' };
}

export interface PaymentMethod {
	value: string;
	title: string;
	subtitle: string;
	icon: string;
	badge?: { text: string; status: 'primary' | 'success' | 'warning' | 'info' };
	details?: string[];
}
