import { IPayment } from '@gauzy/contracts';
import { PaymentService } from '@gauzy/ui-core/core';
import { IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';
import { IChartAmountRecord } from '../expenses/expense-view/expense-view-charts';

/** The payments list: the page's back link, and where it goes once its payment is deleted. */
export const PAYMENTS_LIST_LINK = '/pages/accounting/payments';

/** An invoice's own page, linked from a payment's invoice. */
export const INVOICE_VIEW_LINK = '/pages/accounting/invoices/view';

/** Relations a payment's page reads — the same the payments grid loads. */
export const PAYMENT_VIEW_RELATIONS = [
	'invoice',
	'invoice.toContact',
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

/** The monthly payments chart's spans, in months, and the one it opens on: as the recurring expense page's. */
export const PAYMENT_CHART_MONTH_OPTIONS = [6, 12, 24];
export const PAYMENT_CHART_MONTHS = 12;

/** Relations the organization's payments are read with for the charts: the invoice names the contact it was sent to. */
export const PAYMENT_CHART_RELATIONS = ['invoice'];

/** Reads every payment of the organization, for the page's charts. */
export async function loadOrganizationPayments(service: PaymentService, scope: IRecordViewScope): Promise<IPayment[]> {
	const { items = [] } = await service.getAll(PAYMENT_CHART_RELATIONS, {
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	});
	return items;
}

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
 * The payment's fields the headline does not show as figures: the contact and the project, then the note and the
 * tags. The amount, the date, the invoice and who recorded it are the headline's figures.
 */
export function buildPaymentDetailsSections(payment: IPayment): IRecordViewSection[] {
	return [
		{
			title: 'EXPENSE_VIEW.DETAILS',
			icon: 'info-outline',
			fields: [
				{ label: 'PAYMENTS_PAGE.CONTACT', value: paymentContactName(payment) },
				{ label: 'PAYMENTS_PAGE.PROJECT', key: 'project.name' },
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
