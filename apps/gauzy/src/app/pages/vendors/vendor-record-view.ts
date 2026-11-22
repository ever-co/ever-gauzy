import { Injector } from '@angular/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { IExpense, IOrganizationVendor, PermissionsEnum } from '@gauzy/contracts';
import { ExpensesService, OrganizationVendorsService } from '@gauzy/ui-core/core';
import { IRecordViewField, IRecordViewScope, IRecordViewSection, IRecordViewStatus } from '@gauzy/ui-core/shared';

export interface IVendorExpenseSummary {
	count: number;
	totals: string;
	average: string;
	firstExpenseDate: Date | string | null;
	lastExpenseDate: Date | string | null;
}

export interface IVendorRecord extends IOrganizationVendor {
	code?: string;
	currency?: string;
	paymentTermsDays?: number;
	leadTimeDays?: number;
	minimumOrderAmount?: number;
	expenseSummary?: IVendorExpenseSummary | null;
}

function vendorStatus(vendor: IVendorRecord | undefined, translate: (key: string) => string): IRecordViewStatus | null {
	if (!vendor) {
		return null;
	}
	if (vendor.isArchived) {
		return { text: translate('ORGANIZATIONS_PAGE.ARCHIVED'), tone: 'warning' };
	}
	return vendor.isActive === false
		? { text: translate('INVENTORY_PAGE.INACTIVE'), tone: 'basic' }
		: { text: translate('ORGANIZATIONS_PAGE.ACTIVE'), tone: 'success' };
}

function expenseFields(summary: IVendorExpenseSummary): IRecordViewField[] {
	const fields: IRecordViewField[] = [
		{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.EXPENSE_COUNT', value: summary.count },
		{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.TOTAL_SPENT', value: summary.totals },
		{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.AVERAGE_EXPENSE', value: summary.average },
		{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.FIRST_EXPENSE', value: summary.firstExpenseDate, type: 'date' },
		{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.LAST_EXPENSE', value: summary.lastExpenseDate, type: 'date' }
	];
	return fields.map((field) => ({ ...field, showWhenEmpty: true, permission: PermissionsEnum.ORG_EXPENSES_VIEW }));
}

/** A vendor, described for `ngx-record-view` — the vendors grid's columns read vertically. */
export function buildVendorViewSections(
	vendor: IVendorRecord | undefined,
	translate: (key: string) => string
): IRecordViewSection[] {
	const summary = vendor?.expenseSummary;
	return [
		{
			title: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.CONTACT_DETAILS',
			fields: [
				{ label: 'ORGANIZATIONS_PAGE.NAME', key: 'name', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.PHONE', key: 'phone', type: 'phone', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.EMAIL', key: 'email', type: 'email', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.WEBSITE', key: 'website', type: 'link', showWhenEmpty: true }
			]
		},
		...(summary ? [{ title: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.EXPENSES', fields: expenseFields(summary) }] : []),
		{
			title: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.PURCHASING',
			fields: [
				{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.CODE', key: 'code', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.CURRENCY', key: 'currency', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.PAYMENT_TERMS', key: 'paymentTermsDays', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.LEAD_TIME', key: 'leadTimeDays', showWhenEmpty: true },
				{
					label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.MINIMUM_ORDER',
					key: 'minimumOrderAmount',
					type: 'money',
					showWhenEmpty: true
				}
			]
		},
		{
			title: 'SM_TABLE.TAGS',
			fields: [
				{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true, hideLabel: true, showWhenEmpty: true }
			]
		},
		{
			title: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.RECORD',
			fields: [
				{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.VENDOR_ID', key: 'id', showWhenEmpty: true },
				{ label: 'SM_TABLE.STATUS', value: vendorStatus(vendor, translate), type: 'status', showWhenEmpty: true },
				{ label: 'ORGANIZATIONS_PAGE.VENDOR_VIEW.ARCHIVED_AT', key: 'archivedAt', type: 'datetime' }
			]
		},
		{
			variant: 'meta',
			fields: [
				{ label: 'SM_TABLE.CREATED_AT', key: 'createdAt', type: 'datetime', icon: 'plus-circle-outline' },
				{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'datetime', icon: 'refresh-outline' }
			]
		}
	];
}

function formatAmount(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
	} catch {
		return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${
			currency ?? ''
		}`.trim();
	}
}

export function summarizeVendorExpenses(expenses: IExpense[]): IVendorExpenseSummary {
	const byCurrency = new Map<string, { total: number; count: number }>();
	let firstExpenseDate: Date | string | null = null;
	let lastExpenseDate: Date | string | null = null;

	for (const expense of expenses) {
		const currency = expense.currency ?? '';
		const entry = byCurrency.get(currency) ?? { total: 0, count: 0 };
		entry.total += Number(expense.amount) || 0;
		entry.count += 1;
		byCurrency.set(currency, entry);

		if (expense.valueDate) {
			const date = new Date(expense.valueDate);
			if (!firstExpenseDate || date < new Date(firstExpenseDate)) {
				firstExpenseDate = expense.valueDate;
			}
			if (!lastExpenseDate || date > new Date(lastExpenseDate)) {
				lastExpenseDate = expense.valueDate;
			}
		}
	}

	const entries = [...byCurrency.entries()];
	return {
		count: expenses.length,
		totals: entries.map(([currency, { total }]) => formatAmount(total, currency)).join(' · '),
		average: entries.map(([currency, { total, count }]) => formatAmount(total / count, currency)).join(' · '),
		firstExpenseDate,
		lastExpenseDate
	};
}

export const VENDORS_LIST_LINK = '/pages/organization/vendors';

export async function loadVendor(
	service: OrganizationVendorsService,
	id: string,
	scope: IRecordViewScope
): Promise<IVendorRecord | null> {
	const { items } = await service.getAll(
		{ id, organizationId: scope.organizationId, tenantId: scope.tenantId } as any,
		['tags']
	);
	return items?.find((item) => item.id === id) ?? null;
}

export async function loadVendorExpenses(
	injector: Injector,
	vendorId: string,
	scope: IRecordViewScope,
	relations: string[] = []
): Promise<IExpense[] | null> {
	const canViewExpenses = !!(await injector
		.get(NgxPermissionsService)
		.hasPermission(PermissionsEnum.ORG_EXPENSES_VIEW));
	if (!canViewExpenses) {
		return null;
	}
	try {
		const { items } = await injector
			.get(ExpensesService)
			.getAll(relations, { vendorId, organizationId: scope.organizationId, tenantId: scope.tenantId });
		return items ?? [];
	} catch {
		return null;
	}
}

export async function loadVendorExpenseSummary(
	injector: Injector,
	vendorId: string,
	scope: IRecordViewScope
): Promise<IVendorExpenseSummary | null> {
	const expenses = await loadVendorExpenses(injector, vendorId, scope);
	return expenses ? summarizeVendorExpenses(expenses) : null;
}
