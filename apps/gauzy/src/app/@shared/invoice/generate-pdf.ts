import {
	IInvoice,
	IOrganization,
	IOrganizationContact,
	InvoiceTypeEnum
} from '@gauzy/contracts';

export async function generatePdf(
	invoice: IInvoice,
	organization: IOrganization,
	organizationContact: IOrganizationContact,
	service?: any,
	translatedText?: any
) {
	const body = [];

	for (const item of invoice.invoiceItems) {
		let currentItem = [];
		switch (invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				const employee = await service.getEmployeeById(
					item.employeeId,
					['user']
				);
				currentItem = [
					`${employee.user.firstName} ${employee.user.lastName}`,
					`${item.description}`,
					`${item.quantity}`,
					`${invoice.currency} ${item.price}`,
					`${invoice.currency} ${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				const project = await service.getById(item.projectId);
				currentItem = [
					`${project.name}`,
					`${item.description}`,
					`${item.quantity}`,
					`${invoice.currency} ${item.price}`,
					`${invoice.currency} ${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				const task = await service.getById(item.taskId);
				currentItem = [
					`${task.title}`,
					`${item.description}`,
					`${item.quantity}`,
					`${invoice.currency} ${item.price}`,
					`${invoice.currency} ${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				const product = await service.getById(item.productId);
				currentItem = [
					`${product.name}`,
					`${item.description}`,
					`${item.quantity}`,
					`${invoice.currency} ${item.price}`,
					`${invoice.currency} ${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				const expense = await service.getById(item.expenseId);
				currentItem = [
					`${expense.purpose}`,
					`${item.description}`,
					`${item.quantity}`,
					`${invoice.currency} ${item.price}`,
					`${invoice.currency} ${item.totalValue}`
				];
				break;
			default:
				break;
		}
		body.push(currentItem);
	}

	let widths;
	let tableHeader;
	if (invoice.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS) {
		widths = ['25%', '25%', '25%', '25%'];
		tableHeader = [
			translatedText.description,
			translatedText.quantity,
			translatedText.price,
			translatedText.totalValue
		];
	} else {
		widths = ['20%', '20%', '20%', '20%', '20%'];
		tableHeader = [
			translatedText.item,
			translatedText.description,
			translatedText.quantity,
			translatedText.price,
			translatedText.totalValue
		];
	}
	const docDefinition = {
		content: [
			{
				columns: [
					{
						width: '*',
						text: `${
							invoice.isEstimate
								? translatedText.estimate
								: translatedText.invoice
						} ${translatedText.number}: ${invoice.invoiceNumber}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${translatedText.from}: ${organization.name}`
					},
					{
						width: '50%',
						text: `${translatedText.to}: ${organizationContact.name}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${
							invoice.isEstimate
								? translatedText.estimate
								: translatedText.invoice
						} ${
							translatedText.date
						}: ${invoice.invoiceDate.toString().slice(0, 10)}`
					},
					{
						width: '50%',
						text: `${
							translatedText.dueDate
						}: ${invoice.dueDate.toString().slice(0, 10)}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${translatedText.discountValue}: ${invoice.discountValue}`
					},
					{
						width: '50%',
						text: `${translatedText.discountType}: ${invoice.discountType}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${translatedText.taxValue}: ${invoice.tax}`
					},
					{
						width: '50%',
						text: `${translatedText.taxType}: ${invoice.taxType}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `${translatedText.totalValue}: ${invoice.currency} ${invoice.totalValue}`
					},
					{
						width: '50%',
						text: `${translatedText.currency}: ${invoice.currency}`
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
								width: '50%',
								text: `${translatedText.amountDue}: ${invoice.currency} ${invoice.amountDue}`
							}
					  ]
					: []
			},
			' ',
			' ',
			`${translatedText.paid}: ${
				invoice.paid ? translatedText.yes : translatedText.no
			}`,
			' ',
			' ',
			`${translatedText.terms}: ${invoice.terms}`,
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
