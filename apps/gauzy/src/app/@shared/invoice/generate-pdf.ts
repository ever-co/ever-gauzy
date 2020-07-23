import {
	Invoice,
	Organization,
	OrganizationContact,
	InvoiceTypeEnum
} from '@gauzy/models';

export async function generatePdf(
	invoice: Invoice,
	organization: Organization,
	organizationContact: OrganizationContact,
	service?: any
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
					`${item.price}`,
					`${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				const project = await service.getById(item.projectId);
				currentItem = [
					`${project.name}`,
					`${item.description}`,
					`${item.quantity}`,
					`${item.price}`,
					`${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				const task = await service.getById(item.taskId);
				currentItem = [
					`${task.title}`,
					`${item.description}`,
					`${item.quantity}`,
					`${item.price}`,
					`${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				const product = await service.getById(item.productId);
				currentItem = [
					`${product.name}`,
					`${item.description}`,
					`${item.quantity}`,
					`${item.price}`,
					`${item.totalValue}`
				];
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				const expense = await service.getById(item.expenseId);
				currentItem = [
					`${expense.purpose}`,
					`${item.description}`,
					`${item.quantity}`,
					`${item.price}`,
					`${item.totalValue}`
				];
				break;
			default:
				break;
		}
		body.push(currentItem);
	}

	let widths;
	let tableHeader;
	if (invoice.invoiceType === InvoiceTypeEnum.DETAILS_INVOICE_ITEMS) {
		widths = ['25%', '25%', '25%', '25%'];
		tableHeader = ['Description', 'Quantity', 'Price', 'Total Value'];
	} else {
		widths = ['20%', '20%', '20%', '20%', '20%'];
		tableHeader = [
			'Item',
			'Description',
			'Quantity',
			'Price',
			'Total Value'
		];
	}
	const docDefinition = {
		content: [
			{
				columns: [
					{
						width: '*',
						text: `${
							invoice.isEstimate ? 'Estimate' : 'Invoice'
						} Number: ${invoice.invoiceNumber}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `FROM: ${organization.name}`
					},
					{
						width: '50%',
						text: `TO: ${organizationContact.name}`
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
							invoice.isEstimate ? 'Estimate' : 'Invoice'
						} Date: ${invoice.invoiceDate.toString().slice(0, 10)}`
					},
					{
						width: '50%',
						text: `Due Date: ${invoice.dueDate
							.toString()
							.slice(0, 10)}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `Discount Value: ${invoice.discountValue}`
					},
					{
						width: '50%',
						text: `Discount Type: ${invoice.discountType}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `Tax Value: ${invoice.tax}`
					},
					{
						width: '50%',
						text: `Tax Type: ${invoice.taxType}`
					}
				]
			},
			' ',
			' ',
			{
				columns: [
					{
						width: '50%',
						text: `Total Value: ${invoice.totalValue}`
					},
					{
						width: '50%',
						text: `Currency: ${invoice.currency}`
					}
				]
			},
			' ',
			' ',
			`Paid: ${invoice.paid ? 'Yes' : 'No'}`,
			' ',
			' ',
			`Terms: ${invoice.terms}`,
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
