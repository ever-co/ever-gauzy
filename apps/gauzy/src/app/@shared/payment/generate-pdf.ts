import {
	Payment,
	Organization,
	OrganizationContact,
	Invoice
} from '@gauzy/models';

export async function generatePdf(
	invoice: Invoice,
	payments: Payment[],
	organization: Organization,
	organizationContact: OrganizationContact,
	totalPaid: number
) {
	const body = [];

	for (const payment of payments) {
		const currentPayment = [
			`${payment.paymentDate.toString().slice(0, 10)}`,
			`${payment.amount}`,
			`${
				payment.recordedBy.firstName ? payment.recordedBy.firstName : ''
			} ${
				payment.recordedBy.lastName ? payment.recordedBy.lastName : ''
			}`,
			`${payment.note}`,
			`${payment.overdue ? 'Overdue' : 'On time'}`
		];
		body.push(currentPayment);
	}

	const widths = ['20%', '20%', '20%', '20%', '20%'];
	const tableHeader = [
		'Payment Date',
		'Amount',
		'Recorded By',
		'Note',
		'Status'
	];

	const docDefinition = {
		content: [
			{
				width: '*',
				text: `Payments for invoice ${invoice.invoiceNumber}`,
				fontSize: 20
			},
			' ',
			' ',
			{
				width: '*',
				text: `Due date: ${invoice.dueDate.toString().slice(0, 10)}`
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `Total value: ${invoice.totalValue} ${invoice.currency}`
					},
					{
						width: '50%',
						text: `Total paid: ${totalPaid} ${invoice.currency}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `Received from: ${organizationContact.name}`
					},
					{
						width: '50%',
						text: `Receiver: ${organization.name}`
					}
				]
			},
			' ',
			' ',
			{
				table: {
					widths: widths,
					body: [tableHeader, ...body]
				}
			}
		]
	};
	return docDefinition;
}
