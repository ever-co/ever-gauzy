import * as moment from 'moment';
import { IInvoice, IInvoiceEstimateHistory, InvoiceStatusTypesEnum, IPayment } from '@gauzy/contracts';
import { InvoiceEstimateHistoryService, InvoicesService, PaymentService } from '@gauzy/ui-core/core';
import { IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';
import { IChartAmountRecord } from '../expenses/expense-view/expense-view-charts';

/** The payments list: the page's back link, and where it goes once its payment is deleted. */
export const PAYMENTS_LIST_LINK = '/pages/accounting/payments';

/** An invoice's own page, linked from a payment's invoice. */
export const INVOICE_VIEW_LINK = '/pages/accounting/invoices/view';

/** A contact's and a project's own pages, linked from the payment's details. */
export const CONTACT_VIEW_LINK = '/pages/contacts/view';
export const PROJECT_VIEW_LINK = '/pages/organization/projects/view';

/**
 * Relations a payment's page reads — the same the payments grid loads, and the organization the invoice is from,
 * which the receipt is signed with.
 */
export const PAYMENT_VIEW_RELATIONS = [
	'invoice',
	'invoice.toContact',
	'invoice.fromOrganization',
	'createdByUser',
	'organizationContact',
	'project',
	'tags'
];

/** Relations the payments of one invoice are read with, for the page's table of them. */
export const INVOICE_PAYMENTS_RELATIONS = ['createdByUser'];

/**
 * Reads one payment of the organization. The payments read requires the organization and tenant in its filter (400
 * without them), and may answer more than the id asks for: the payment is picked out of what it answers.
 */
export async function loadPayment(service: PaymentService, id: string, scope: IRecordViewScope): Promise<IPayment | null> {
	const { items } = await service.getAll(PAYMENT_VIEW_RELATIONS, {
		id,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	} as any);
	return items?.find((item) => item.id === id) ?? null;
}

/** Reads every payment recorded against one invoice, oldest first. */
export async function loadInvoicePayments(
	service: PaymentService,
	invoiceId: string,
	scope: IRecordViewScope
): Promise<IPayment[]> {
	const { items = [] } = await service.getAll(INVOICE_PAYMENTS_RELATIONS, {
		invoiceId,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	});
	return items
		.filter((item) => (item.invoiceId ?? item.invoice?.id) === invoiceId)
		.sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
}

/** How many of the invoice's latest changes the activity panel lists. */
export const INVOICE_ACTIVITY_LIMIT = 8;

/** Reads the invoice's history — who recorded, edited or deleted its payments, and the rest — newest first. */
export async function loadInvoiceActivity(
	service: InvoiceEstimateHistoryService,
	invoiceId: string,
	scope: IRecordViewScope
): Promise<IInvoiceEstimateHistory[]> {
	const { items = [] } = await service.getAll(['user'], {
		invoiceId,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	});
	return items
		.filter((item) => item.invoiceId === invoiceId)
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, INVOICE_ACTIVITY_LIMIT);
}

/** The payments' read is paged: at most this many a page, which is the endpoint's own ceiling. */
const PAYMENT_PAGE_SIZE = 100;

/**
 * A read of the payments in a date range stops after this many pages. The charts' reads are bounded by their range
 * (one contact's payments over the chart's months, or one month of payments in one currency), so the ceiling is
 * only a guard against an organization that records thousands of them a month.
 */
const PAYMENT_READ_MAX_PAGES = 20;

/** How many payments either side of one are read to find its previous and next: enough for those of the same day. */
const PAYMENT_NEIGHBOUR_READ = 10;

/** The payments endpoint's date range takes UTC `YYYY-MM-DD HH:mm:ss`, as the payments grid sends it. */
function paymentDateBound(value: moment.MomentInput): string {
	return moment.utc(value).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * Reads the organization's payments with a payment date in a range, page by page, without their relations: the
 * charts need the amount, the currency, the date and the contact, which are the payment's own columns.
 */
async function loadPaymentsBetween(
	service: PaymentService,
	scope: IRecordViewScope,
	start: moment.Moment,
	end: moment.Moment,
	where: Record<string, unknown> = {}
): Promise<IPayment[]> {
	const payments: IPayment[] = [];
	for (let page = 1; page <= PAYMENT_READ_MAX_PAGES; page++) {
		const { items = [], total = 0 } = await service.pagination({
			where: {
				organizationId: scope.organizationId,
				tenantId: scope.tenantId,
				paymentDate: { startDate: paymentDateBound(start), endDate: paymentDateBound(end) },
				...where
			},
			order: { paymentDate: 'ASC' },
			take: PAYMENT_PAGE_SIZE,
			skip: page
		});
		payments.push(...items);
		if (!items.length || payments.length >= total) break;
	}
	return payments;
}

/**
 * The monthly chart's payments: those from the payment's contact (every payment when it names none), in its
 * currency, over the `months` months ending with its own.
 */
export async function loadContactMonthsPayments(
	service: PaymentService,
	scope: IRecordViewScope,
	payment: IPayment,
	months: number
): Promise<IPayment[]> {
	const month = moment.utc(payment.paymentDate);
	const contactId = paymentContactId(payment);
	return loadPaymentsBetween(
		service,
		scope,
		month.clone().subtract(months - 1, 'months').startOf('month'),
		month.clone().endOf('month'),
		{
			...(payment.currency ? { currency: payment.currency } : {}),
			...(contactId ? { organizationContactId: contactId } : {})
		}
	);
}

/** The share chart's payments: every payment of the organization in the payment's month and currency. */
export async function loadMonthPayments(
	service: PaymentService,
	scope: IRecordViewScope,
	payment: IPayment
): Promise<IPayment[]> {
	const month = moment.utc(payment.paymentDate);
	return loadPaymentsBetween(service, scope, month.clone().startOf('month'), month.clone().endOf('month'), {
		...(payment.currency ? { currency: payment.currency } : {})
	});
}

/**
 * The payments either side of one: the few just before and just after its payment date — those of the same day
 * among them — read apart, then put in order by {@link paymentNeighbours}.
 */
export async function loadPaymentNeighbours(
	service: PaymentService,
	scope: IRecordViewScope,
	payment: IPayment
): Promise<{ previous: IPayment | null; next: IPayment | null }> {
	if (!payment.paymentDate) {
		return { previous: null, next: null };
	}
	const read = (startDate: string, endDate: string, direction: 'ASC' | 'DESC') =>
		service.pagination({
			where: {
				organizationId: scope.organizationId,
				tenantId: scope.tenantId,
				paymentDate: { startDate, endDate }
			},
			order: { paymentDate: direction, createdAt: direction },
			take: PAYMENT_NEIGHBOUR_READ,
			skip: 1
		});
	const date = paymentDateBound(payment.paymentDate);
	const [before, after] = await Promise.all([
		read(paymentDateBound(0), date, 'DESC'),
		read(date, paymentDateBound('9999-12-31T23:59:59Z'), 'ASC')
	]);
	// Both reads hold the payments of the same instant, this one among them: each is kept once.
	const unique = new Map<string, IPayment>();
	for (const item of [...(before.items ?? []), ...(after.items ?? [])]) {
		unique.set(item.id, item);
	}
	return paymentNeighbours([...unique.values()], payment);
}

/**
 * The invoice's status for what is paid of it, as the invoice's payments page sets it: partly paid, fully paid or
 * overpaid. Nothing paid moves an invoice back to Viewed only from a paid status; a draft or a sent invoice keeps its
 * own.
 */
function invoicePaymentStatus(total: number, paid: number, current: string | undefined): string | null {
	if (paid <= 0) {
		const paidStatuses: string[] = [
			InvoiceStatusTypesEnum.PARTIALLY_PAID,
			InvoiceStatusTypesEnum.FULLY_PAID,
			InvoiceStatusTypesEnum.OVERPAID
		];
		return current && paidStatuses.includes(current) ? InvoiceStatusTypesEnum.VIEWED : null;
	}
	if (paid < total) return InvoiceStatusTypesEnum.PARTIALLY_PAID;
	if (paid === total) return InvoiceStatusTypesEnum.FULLY_PAID;
	return InvoiceStatusTypesEnum.OVERPAID;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Whether a payment counts toward its invoice's paid total: only a payment in the invoice's currency does, since an
 * amount in another currency cannot be added to it. The payment stays listed with the invoice's payments; it is left
 * out of what they add up to. Either currency missing counts it, as before currencies were compared.
 */
export function countsTowardInvoice(payment: IPayment, invoice: IInvoice): boolean {
	return !payment.currency || !invoice?.currency || payment.currency === invoice.currency;
}

/**
 * Saves on the invoice what its payments add up to — `alreadyPaid`, `amountDue`, `paid` and its status — after a
 * payment of it was recorded, edited or deleted, as the invoice's payments page does after each change: the payments
 * endpoint leaves the invoice as it was.
 */
export async function syncInvoicePaidState(
	paymentService: PaymentService,
	invoicesService: InvoicesService,
	invoice: IInvoice,
	scope: IRecordViewScope
): Promise<void> {
	const payments = await loadInvoicePayments(paymentService, invoice.id, scope);
	const total = roundMoney(Number(invoice.totalValue) || 0);
	const paid = roundMoney(
		payments
			.filter((item) => countsTowardInvoice(item, invoice))
			.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
	);
	const status = invoicePaymentStatus(total, paid, invoice.status);
	await invoicesService.updateAction(invoice.id, {
		alreadyPaid: paid,
		amountDue: roundMoney(Math.max(0, total - paid)),
		paid: total > 0 && paid >= total,
		...(status ? { status } : {})
	} as any);
}

/** The payments either side of one, by payment date (then by when they were recorded): the page's previous / next. */
export function paymentNeighbours(
	payments: IPayment[],
	payment: IPayment
): { previous: IPayment | null; next: IPayment | null } {
	const time = (value: Date | string | undefined) => (value ? new Date(value).getTime() : 0);
	const list = (payments.some((item) => item.id === payment.id) ? payments : [...payments, payment])
		.filter((item) => !!item.paymentDate)
		.sort(
			(a, b) =>
				time(a.paymentDate) - time(b.paymentDate) ||
				time(a.createdAt) - time(b.createdAt) ||
				String(a.id).localeCompare(String(b.id))
		);
	const index = list.findIndex((item) => item.id === payment.id);
	if (index < 0) {
		return { previous: null, next: null };
	}
	return { previous: list[index - 1] ?? null, next: list[index + 1] ?? null };
}

/**
 * When the payment was made against its invoice's due date, in whole days: negative before it, 0 on it, positive
 * after it. `null` when either date is missing.
 */
export function paymentDaysFromDue(payment: IPayment): number | null {
	const due = payment.invoice?.dueDate;
	if (!payment.paymentDate || !due) {
		return null;
	}
	return moment(payment.paymentDate).startOf('day').diff(moment(due).startOf('day'), 'days');
}

/** The monthly payments chart's spans, in months, and the one it opens on: as the recurring expense page's. */
export const PAYMENT_CHART_MONTH_OPTIONS = [6, 12, 24];
export const PAYMENT_CHART_MONTHS = 12;

/** The id of the contact the payment came from: its own contact, or the one its invoice was sent to. */
export function paymentContactId(payment: IPayment): string | null {
	// The invoice's row carries the id of the contact it was sent to; the shared invoice model does not name it.
	const invoice = payment.invoice as (IPayment['invoice'] & { toContactId?: string }) | undefined;
	return (
		payment.organizationContactId ??
		payment.organizationContact?.id ??
		invoice?.toContactId ??
		invoice?.toContact?.id ??
		invoice?.organizationContactId ??
		null
	);
}

/** A payment as the expense page's charts add amounts up: its amount and currency, dated by its payment date. */
export function paymentChartRecord(payment: IPayment): IChartAmountRecord {
	return { id: payment.id, amount: payment.amount, currency: payment.currency, valueDate: payment.paymentDate };
}

/** Who the payment came from: its own contact, or the contact its invoice was sent to. */
export function paymentContactName(payment: IPayment): string | null {
	return (payment.organizationContact || payment.invoice?.toContact)?.name ?? null;
}

/**
 * The payment's fields the headline does not show as figures: the contact and the project — links to their own pages
 * for a viewer who may open them — then the note and the tags. The amount, the date, the invoice and who recorded it
 * are the headline's figures.
 */
export function buildPaymentDetailsSections(
	payment: IPayment,
	links: { contact: boolean; project: boolean } = { contact: false, project: false }
): IRecordViewSection[] {
	const contactId = paymentContactId(payment);
	const projectId = payment.project?.id ?? payment.projectId;
	return [
		{
			title: 'EXPENSE_VIEW.DETAILS',
			icon: 'info-outline',
			fields: [
				links.contact && contactId
					? {
							label: 'PAYMENTS_PAGE.CONTACT',
							value: paymentContactName(payment),
							type: 'link',
							route: [CONTACT_VIEW_LINK, contactId]
					  }
					: { label: 'PAYMENTS_PAGE.CONTACT', value: paymentContactName(payment) },
				links.project && projectId
					? {
							label: 'PAYMENTS_PAGE.PROJECT',
							key: 'project.name',
							type: 'link',
							route: [PROJECT_VIEW_LINK, projectId]
					  }
					: { label: 'PAYMENTS_PAGE.PROJECT', key: 'project.name' },
				{ label: 'PAYMENTS_PAGE.NOTE', key: 'note', type: 'multiline', wide: true },
				{ label: 'PAYMENTS_PAGE.TAGS', key: 'tags', type: 'tags', wide: true }
			]
		}
	];
}

/** The created / updated stamps. */
export const PAYMENT_META_SECTIONS: IRecordViewSection[] = [
	{
		variant: 'meta',
		fields: [
			{ label: 'SM_TABLE.CREATED_AT', key: 'createdAt', type: 'datetime', icon: 'plus-circle-outline' },
			{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'datetime', icon: 'refresh-outline' }
		]
	}
];
