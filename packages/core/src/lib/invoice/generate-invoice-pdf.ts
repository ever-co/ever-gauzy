import { IInvoice, IOrganization, IOrganizationContact, InvoiceTypeEnum } from '@gauzy/contracts';

export async function generateInvoicePdfDefinition(
	invoice: IInvoice,
	organization: IOrganization,
	organizationContact: IOrganizationContact,
	translatedText?: any,
	language?: string
) {
	const body = [];
	for (const item of invoice.invoiceItems) {
		const currentItem = [
			`${item.description}`,
			`${item.quantity}`,
			`${invoice.currency} ${item.price}`,
			`${invoice.currency} ${item.totalValue}`
		];
		switch (invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS: {
				const employee = item.employee;
				currentItem[0] = `${employee.user.name}`;
				break;
			}
			case InvoiceTypeEnum.BY_PROJECT_HOURS: {
				const project = item.project;
				currentItem[0] = `${project.name}`;
				break;
			}
			case InvoiceTypeEnum.BY_TASK_HOURS: {
				const task = item.task;
				currentItem[0] = `${task.title}`;
				break;
			}
			case InvoiceTypeEnum.BY_PRODUCTS: {
				let product: any = item.product;
				product = product.translate(language);
				currentItem[0] = `${product.name}`;
				break;
			}
			case InvoiceTypeEnum.BY_EXPENSES: {
				const expense = item.expense;
				currentItem[0] = `${expense.purpose}`;
				break;
			}
			default:
				break;
		}
		body.push(currentItem);
	}

	const widths = ['25%', '25%', '25%', '25%'];
	const tableHeader = [translatedText.item, translatedText.quantity, translatedText.price, translatedText.totalValue];

	const docDefinition = {
		watermark: {
			text: `${invoice.paid ? translatedText.paid.toUpperCase() : ''}`,
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
						width: '50%',
						text: [
							{
								bold: true,
								text: `${translatedText.from}:\n`
							},
							`${invoice.fromUser?.name ?? organization.name}`
						]
					},
					{
						fontSize: 16,
						bold: true,
						width: '50%',
						alignment: 'right',
						text: `${invoice.isEstimate ? translatedText.estimate : translatedText.invoice} ${
							translatedText.number
						}: ${invoice.invoiceNumber}`
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
								text: `${invoice.isEstimate ? translatedText.estimate : translatedText.invoice} ${
									translatedText.date
								}: `
							},
							`${invoice.invoiceDate.toString().slice(0, 10)}`
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
								text: `${translatedText.dueDate}: `
							},
							`${invoice.dueDate.toString().slice(0, 10)}`
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
								text: `${translatedText.currency}: `
							},
							`${invoice.currency}`
						]
					}
				]
			},
			' ',
			{
				text: [
					{
						bold: true,
						text: `${translatedText.to}:\n`
					},
					`${organizationContact?.name ?? organization.name}`
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
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '65%',
						text: ``
					},
					{
						bold: true,
						alignment: 'right',
						width: '25%',
						text: `${translatedText.taxValue}:`
					},
					{
						alignment: 'right',
						width: '10%',
						text: `${invoice.taxType === 'FLAT' ? invoice.currency : ''} ${invoice.tax}${
							invoice.taxType === 'PERCENT' ? '%' : ''
						}`
					}
				]
			},
			' ',
			{
				columns: [
					{
						width: '65%',
						text: ``
					},
					{
						bold: true,
						alignment: 'right',
						width: '25%',
						text: `${translatedText.taxValue} 2:`
					},
					{
						alignment: 'right',
						width: '10%',
						text: `${invoice.tax2Type === 'FLAT' ? invoice.currency : ''} ${invoice.tax2}${
							invoice.tax2Type === 'PERCENT' ? '%' : ''
						}`
					}
				]
			},
			' ',
			{
				columns: [
					{
						width: '65%',
						text: ``
					},
					{
						bold: true,
						alignment: 'right',
						width: '25%',
						text: `${translatedText.discountValue}:`
					},
					{
						alignment: 'right',
						width: '10%',
						text: `${invoice.discountType === 'FLAT' ? invoice.currency : ''} ${invoice.discountValue}${
							invoice.discountType === 'PERCENT' ? '%' : ''
						}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						bold: true,
						alignment: 'right',
						text: `${translatedText.totalValue}: ${invoice.currency} ${invoice.totalValue}`
					}
				]
			},
			invoice.hasRemainingAmountInvoiced ? ' ' : '',
			invoice.hasRemainingAmountInvoiced ? ' ' : '',
			{
				columns: invoice.hasRemainingAmountInvoiced
					? [
							{
								width: '50%',
								text: `${translatedText.alreadyPaid}: ${invoice.currency} ${invoice.alreadyPaid}`
							},
							{
								alignment: 'right',
								width: '50%',
								text: `${translatedText.amountDue}: ${invoice.currency} ${invoice.amountDue}`
							}
					  ]
					: []
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '*',
						text: [
							{
								bold: true,
								text: `${translatedText.notes}\n\n`
							},
							`${invoice.terms}`
						]
					}
				]
			}
		]
	};
	return docDefinition;
}
