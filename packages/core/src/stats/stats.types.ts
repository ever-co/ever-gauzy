import { InvoiceStats, PaymentStats } from '@gauzy/contracts';

/**
 * Interface representing global stats.
 */
export interface GlobalStats {
	tenants: number;
	users: number;
	employees: number;
	tasks: number;
	teams: number;
	invoices: InvoiceStats;
	payments: PaymentStats;
	organizations: number;
	hours: number;
}
