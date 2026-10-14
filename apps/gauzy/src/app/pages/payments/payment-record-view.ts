import { Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BaseEntityEnum, IPayment } from '@gauzy/contracts';
import { PaymentService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations a payment's View reads — the same the payments grid loads. */
export const PAYMENT_VIEW_RELATIONS = [
	'invoice',
	'invoice.toContact',
	'createdByUser',
	'organizationContact',
	'project',
	'tags'
];

/**
 * A payment, described for `ngx-record-view` — the payments grid's columns read vertically, with the
 * grid's own status badge (on time / overdue) and translated payment method.
 */
export function buildPaymentViewSections(payment: IPayment, translate: (key: string) => string): IRecordViewSection[] {
	const contact = payment.organizationContact || payment.invoice?.toContact;
	const invoiceNumber = payment.invoice?.invoiceNumber;
	return [
		{
			fields: [
				{ label: 'INVOICES_PAGE.INVOICE_NUMBER', value: invoiceNumber ? `#${invoiceNumber}` : null },
				{ label: 'PAYMENTS_PAGE.PAYMENT_DATE', key: 'paymentDate', type: 'date' },
				{ label: 'PAYMENTS_PAGE.AMOUNT', key: 'amount', type: 'money' },
				{
					label: 'PAYMENTS_PAGE.PAYMENT_METHOD',
					value: payment.paymentMethod ? translate(`INVOICES_PAGE.PAYMENTS.${payment.paymentMethod}`) : null
				},
				{
					label: 'PAYMENTS_PAGE.STATUS',
					type: 'badge',
					value: payment.overdue
						? { text: translate('INVOICES_PAGE.PAYMENTS.OVERDUE'), class: 'danger' }
						: { text: translate('INVOICES_PAGE.PAYMENTS.ON_TIME'), class: 'success' }
				},
				{ label: 'PAYMENTS_PAGE.RECORDED_BY', value: payment.createdByUser?.name },
				{ label: 'PAYMENTS_PAGE.CONTACT', value: contact?.name },
				{ label: 'PAYMENTS_PAGE.PROJECT', key: 'project.name' }
			]
		},
		{
			fields: [
				{ label: 'PAYMENTS_PAGE.NOTE', key: 'note', type: 'multiline', wide: true },
				{ label: 'PAYMENTS_PAGE.TAGS', key: 'tags', type: 'tags', wide: true }
			]
		}
	];
}

/** `/pages/accounting/payments/view/:id` — one payment, full width (what a payment favorite opens). */
export const PAYMENT_RECORD_VIEW: IRecordViewRouteData<IPayment> = {
	heading: 'PAYMENTS_PAGE.HEADER',
	backLink: '/pages/accounting/payments',
	// The payments read requires the organization and tenant in its filter (400 without them).
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector
			.get(PaymentService)
			.getAll(PAYMENT_VIEW_RELATIONS, {
				id,
				organizationId: scope.organizationId,
				tenantId: scope.tenantId
			} as any);
		return items?.[0] ?? null;
	},
	sections: (payment, injector) => {
		const translateService = injector.get(TranslateService);
		return buildPaymentViewSections(payment, (key) => translateService.instant(key));
	},
	subtitle: (payment) => (payment.invoice?.invoiceNumber ? `#${payment.invoice.invoiceNumber}` : null),
	favorite: { entity: BaseEntityEnum.Payment, name: (payment) => payment.note }
};
