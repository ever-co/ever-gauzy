import {
	IPayment,
	IOrganization,
	IOrganizationContact,
	IInvoice
} from '@gauzy/models';

export async function generatePdf(
	invoice: IInvoice,
	payments: IPayment[],
	organization: IOrganization,
	organizationContact: IOrganizationContact,
	totalPaid: number,
	translatedText?: any
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
			`${
				payment.overdue ? translatedText.overdue : translatedText.onTime
			}`
		];
		body.push(currentPayment);
	}

	const widths = ['20%', '20%', '20%', '20%', '20%'];
	const tableHeader = [
		translatedText.paymentDate,
		translatedText.amount,
		translatedText.recordedBy,
		translatedText.note,
		translatedText.status
	];

	const docDefinition = {
		content: [
			{
				width: '*',
				text: `${translatedText.paymentsForInvoice} ${invoice.invoiceNumber}`,
				fontSize: 20
			},
			' ',
			' ',
			{
				width: '*',
				text: `${
					translatedText.dueDate
				}: ${invoice.dueDate.toString().slice(0, 10)}`
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${translatedText.totalValue}: ${invoice.totalValue} ${invoice.currency}`
					},
					{
						width: '50%',
						text: `${translatedText.totalPaid}: ${totalPaid} ${invoice.currency}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${translatedText.receivedFrom}: ${organizationContact.name}`
					},
					{
						width: '50%',
						text: `${translatedText.receiver}: ${organization.name}`
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
