import { ExpenseStatusesEnum, ExpenseTypesEnum, IExpense, PermissionsEnum, TaxTypesEnum } from '@gauzy/contracts';
import { ExpensesService } from '@gauzy/ui-core/core';
import { IRecordViewScope, IRecordViewSection, toActualReceipt } from '@gauzy/ui-core/shared';

/** Relations an expense's View reads — the same the expenses grid loads. */
export const EXPENSE_VIEW_RELATIONS = [
	'employee',
	'employee.user',
	'category',
	'vendor',
	'tags',
	'project',
	'organizationContact'
];

/**
 * Files that are documents, not pictures. A receipt is attached through an image upload, so anything else is tried
 * as an image — the stored name need not end in an image extension — and offered as a link if it fails to load.
 */
const DOCUMENT_RECEIPT = /\.(pdf|docx?|xlsx?|ods|odt|csv|txt|zip)(\?.*)?$/i;

/** The status badge of the expenses grid: paid green, invoiced amber, otherwise red. */
export function expenseStatusBadge(value: ExpenseStatusesEnum | string): { text: string; class: string | null } | null {
	if (!value) {
		return null; // no status: no badge (the row is left out)
	}
	const badgeClass =
		value === ExpenseStatusesEnum.PAID ? 'success' : value === ExpenseStatusesEnum.INVOICED ? 'warning' : 'danger';
	return { text: String(value ?? '').replace(/_/g, ' '), class: badgeClass };
}

/** i18n key of an expense type, as the expense form lists it; none for a type the form does not know. */
export function expenseTypeKey(type: ExpenseTypesEnum | string): string | null {
	return Object.values(ExpenseTypesEnum).includes(type as ExpenseTypesEnum) ? `EXPENSES_PAGE.MUTATION.${type}` : null;
}

/** An amount in the expense's currency, as plain text — or the bare figure when the currency is unknown. */
export function formatExpenseMoney(value: number, currency: string, locale?: string): string {
	try {
		return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
	} catch {
		return `${value} ${currency ?? ''}`.trim();
	}
}

/**
 * The tax an expense was entered with: its rate as the form took it (a percentage or an amount in the expense's
 * currency) and its label. None when no tax was entered.
 */
export function expenseTaxOf(expense: IExpense, locale?: string): { rate: string; label: string | null } | null {
	const rate = Number(expense?.rateValue);
	if (!rate) {
		return null;
	}
	return {
		rate: expense.taxType === TaxTypesEnum.VALUE ? formatExpenseMoney(rate, expense.currency, locale) : `${rate}%`,
		label: expense.taxLabel || null
	};
}

/** The receipt an expense really has — none for the legacy placeholder — and whether to try it as an image. */
export function expenseReceiptOf(expense: IExpense): { url: string; isImage: boolean } | null {
	const url = toActualReceipt(expense?.receipt?.trim());
	if (!url) {
		return null;
	}
	return { url, isImage: !DOCUMENT_RECEIPT.test(url) };
}

/**
 * Reads one expense with everything its View shows, within the organization selected in the header. The expense
 * API's `GET /expense/:id` takes no relations, so the list read filtered by id is the one that brings the vendor,
 * category, project, contact, employee and tags along.
 */
export async function loadExpense(service: ExpensesService, id: string, scope: IRecordViewScope): Promise<IExpense | null> {
	const { items } = await service.getAll(EXPENSE_VIEW_RELATIONS, {
		id,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	} as any);
	return items?.find((item) => item.id === id) ?? null;
}

/**
 * An expense, described for `ngx-record-view` — the grid columns read vertically, then what the form took that the
 * grid has no column for: the type and the tax. Used by the expenses drawer (a quick look); the expense's own page
 * lays the same facts out in its columns.
 *
 * @param translate Translates the type's key: a field's value is shown as given, so the caller builds the sections
 * again when the language changes.
 * @param locale The app's language, which formats a flat tax amount; the browser's when not given.
 */
export function buildExpenseViewSections(
	expense: IExpense,
	translate: (key: string) => string,
	locale?: string
): IRecordViewSection[] {
	const typeKey = expenseTypeKey(expense?.typeOfExpense);
	const tax = expenseTaxOf(expense, locale);
	return [
		{
			fields: [
				{ label: 'SM_TABLE.DATE', key: 'valueDate', type: 'date' },
				{ label: 'SM_TABLE.VALUE', key: 'amount', type: 'money' },
				// `statuses` is the `{ text, class }` badge the grid derives when the rows are loaded.
				{ label: 'SM_TABLE.STATUS', key: 'statuses', type: 'badge' },
				{ label: 'SM_TABLE.VENDOR', key: 'vendor.name' },
				{ label: 'SM_TABLE.CATEGORY', key: 'category.name' },
				{ label: 'EXPENSE_VIEW.TYPE', value: typeKey ? translate(typeKey) : null },
				{ label: 'SM_TABLE.PROJECT', key: 'project.name' },
				{ label: 'SM_TABLE.CONTACT', key: 'organizationContact.name' },
				{
					label: 'SM_TABLE.EMPLOYEE',
					key: 'employee',
					type: 'person',
					// Same rule the grid applies: without this permission the
					// employee column is removed, so the View must not show it either.
					permission: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				},
				{ label: 'EXPENSES_PAGE.SPLIT_EXPENSE', key: 'splitExpense', type: 'boolean' },
				{ label: 'EXPENSES_PAGE.MUTATION.TAX_RATE', value: tax?.rate ?? null, divider: true },
				{ label: 'EXPENSE_VIEW.TAX_LABEL', value: tax?.label ?? null }
			]
		},
		{
			fields: [
				{ label: 'POP_UPS.PURPOSE', key: 'purpose', type: 'multiline', wide: true },
				{ label: 'SM_TABLE.NOTES', key: 'notes', type: 'multiline', wide: true },
				{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }
			]
		}
	];
}
