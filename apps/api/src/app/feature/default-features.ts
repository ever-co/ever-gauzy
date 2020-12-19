import { gauzyToggleFeatures } from '@env-api/environment';
import { IFeatureCreateInput } from '@gauzy/models';

const features = gauzyToggleFeatures;

export const DEFAULT_FEATURES: IFeatureCreateInput[] = [
	{
		name: 'Dashboard',
		code: 'FEATURE_DASHBOARD',
		description: 'Go to dashboard',
		image: 'dashboard.png',
		link: 'dashboard/accounting',
		isEnabled: features.FEATURE_DASHBOARD
	},
	{
		name: 'Time Tracking',
		code: 'FEATURE_TIME_TRACKING',
		description: 'Download Desktop App, Create First Timesheet',
		image: 'dashboard.png',
		link: 'employees/timesheets',
		isEnabled: features.FEATURE_TIME_TRACKING
	},
	{
		name: 'Estimate',
		code: 'FEATURE_ESTIMATE',
		description: 'Create First Estimate',
		image: 'dashboard.png',
		link: 'accounting/invoices/estimates',
		isEnabled: features.FEATURE_ESTIMATE
	},
	{
		name: 'Estimate Received',
		code: 'FEATURE_ESTIMATE_RECEIVED',
		description: 'Received Estimate',
		image: 'dashboard.png',
		link: 'accounting/invoices/estimates',
		isEnabled: features.FEATURE_ESTIMATE_RECEIVED
	},
	{
		name: 'Invoice',
		code: 'FEATURE_INVOICE',
		description: 'Create First Invoice',
		image: 'dashboard.png',
		link: 'accounting/invoices',
		isEnabled: features.FEATURE_INVOICE
	},
	{
		name: 'Invoice Recurring',
		code: 'FEATURE_INVOICE_RECURRING',
		description: 'Received Recurring Invoice',
		image: 'dashboard.png',
		link: 'accounting/invoices',
		isEnabled: features.FEATURE_INVOICE_RECURRING
	},
	{
		name: 'Income',
		code: 'FEATURE_INCOME',
		description: 'Create First Income',
		image: 'dashboard.png',
		link: 'accounting/income',
		isEnabled: features.FEATURE_INCOME
	},
	{
		name: 'Expense',
		code: 'FEATURE_EXPENSE',
		description: 'Create First Expense',
		image: 'dashboard.png',
		link: 'accounting/expenses',
		isEnabled: features.FEATURE_EXPENSE
	}
];
