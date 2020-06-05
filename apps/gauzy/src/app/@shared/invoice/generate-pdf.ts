import {
	Invoice,
	Organization,
	OrganizationClients,
	InvoiceTypeEnum
} from '@gauzy/models';

export async function generatePdf(
	invoice: Invoice,
	organization: Organization,
	client: OrganizationClients,
	service?: any
) {
	const body = [];

	for (const item of invoice.invoiceItems) {
		if (item.employeeId) {
			const employee = await service.getEmployeeById(item.employeeId, [
				'user'
			]);
			const currentItem = [
				`${employee.user.firstName} ${employee.user.lastName}`,
				`${item.description}`,
				`${item.quantity}`,
				`${item.price}`,
				`${item.totalValue}`
			];
			body.push(currentItem);
		} else if (item.projectId) {
			const project = await service.getById(item.projectId);
			const currentItem = [
				`${project.name}`,
				`${item.description}`,
				`${item.quantity}`,
				`${item.price}`,
				`${item.totalValue}`
			];
			body.push(currentItem);
		} else if (item.taskId) {
			const task = await service.getById(item.taskId);
			const currentItem = [
				`${task.title}`,
				`${item.description}`,
				`${item.quantity}`,
				`${item.price}`,
				`${item.totalValue}`
			];
			body.push(currentItem);
		} else if (item.productId) {
			const product = await service.getById(item.productId);
			const currentItem = [
				`${product.name}`,
				`${item.description}`,
				`${item.quantity}`,
				`${item.price}`,
				`${item.totalValue}`
			];
			body.push(currentItem);
		} else {
			const currentItem = [
				`${item.description}`,
				`${item.quantity}`,
				`${item.price}`,
				`${item.totalValue}`
			];
			body.push(currentItem);
		}
	}

	let widths;
	let tableHeader;
	if (invoice.invoiceType === InvoiceTypeEnum.DETAILS_INVOICE_ITEMS) {
		widths = ['25%', '25%', '25%', '25%'];
		tableHeader = ['Description', 'Quantity', 'Price', 'Total Value'];
	} else {
		widths = ['20%', '20%', '20%', '20%', '20%'];
		tableHeader = [
			'Name',
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
						text: `TO: ${client.name}`
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
