import { IPayment, IOrganization, IOrganizationContact, IInvoice } from '@gauzy/contracts';

import * as moment from 'moment';
import 'moment-timezone';
import { formatCurrencyAmount } from './invoice-currency.util';

/**
 * Formats a stored date as a calendar day of the organization's time zone.
 *
 * The forms save a picked day as the browser's local midnight, so "5 October" picked in UTC+2 is
 * stored as `2026-10-04T22:00:00Z`; formatting that on a UTC server printed 4 October. The
 * organization's zone is the closest thing the server knows to the zone the day was picked in; an
 * organization without one falls back to the server zone, as the reports do.
 */
const formatDay = (date: Date | string, organization: IOrganization): string => {
	const timeZone = organization?.timeZone?.trim() || moment.tz.guess();
	return moment.utc(date).tz(timeZone).format(organization?.dateFormat || 'YYYY-MM-DD');
};

export async function generateInvoicePaymentPdfDefinition(
	invoice: IInvoice,
	payments: IPayment[],
	organization: IOrganization,
	organizationContact: IOrganizationContact,
	totalPaid: number,
	translatedText?: any
) {
	// Every amount follows the organization's "Currency Position" setting, like the web app does.
	const amount = (value: number | string) =>
		formatCurrencyAmount(value, invoice.currency, organization?.currencyPosition);

	const body = [];

	for (const payment of payments) {
		const currentPayment = [
			// The column is headed "Payment Date": print the payment's own date, not the invoice due date.
			formatDay(payment.paymentDate ?? payment.createdAt, organization),
			amount(payment.amount),
			`${payment.createdByUser.name}`,
			`${payment.note ? payment.note : '-'}`,
			`${payment.overdue ? translatedText.overdue : translatedText.onTime}`
		];
		body.push(currentPayment);
	}

	// The amount now carries its currency code ("USD 1500"), which a 10% column wraps from 3 digits on
	const widths = ['25%', '20%', '20%', '20%', '15%'];
	const tableHeader = [
		translatedText.paymentDate,
		translatedText.amount,
		translatedText.createdByUser,
		translatedText.note,
		translatedText.status
	];

	const docDefinition = {
		watermark: {
			text: `${invoice.paid ? 'PAID' : ''}`,
			color: '#B7D7E8',
			opacity: 0.2,
			bold: true,
			fontSize: 108,
			italics: false
		},
		content: [
			{
				columns: [
					{
						fontSize: 16,
						bold: true,
						width: '*',
						alignment: 'left',
						text: `${translatedText.paymentsForInvoice} ${invoice.invoiceNumber}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: [
							{
								bold: true,
								text: `${translatedText.receivedFrom}:\n`
							},
							`${organizationContact.name}`
						]
					}
				]
			},
			' ',
			{
				columns: [
					{
						alignment: 'right',
						text: [
							{
								bold: true,
								text: `${translatedText.dueDate}: `
							},
							formatDay(invoice.dueDate, organization)
						]
					}
				]
			},
			{
				columns: [
					{
						alignment: 'right',
						text: [
							{
								bold: true,
								text: `${translatedText.totalValue}: `
							},
							amount(invoice.totalValue)
						]
					}
				]
			},
			{
				columns: [
					{
						alignment: 'right',
						text: [
							{
								bold: true,
								text: `${translatedText.totalPaid}: `
							},
							amount(totalPaid)
						]
					}
				]
			},
			{
				text: [
					{
						bold: true,
						text: `${translatedText.receiver}:\n`
					},
					`${organization.name}`
				]
			},
			' ',
			' ',
			{
				table: {
					widths: widths,
					body: [tableHeader, ...body]
				},
				layout: {
					fillColor: function (rowIndex, node, columnIndex) {
						return rowIndex % 2 === 0 ? '#E6E6E6' : null;
					},
					defaultBorder: false,
					border: [false, false, false, false]
				}
			}
		]
	};
	return docDefinition;
}
