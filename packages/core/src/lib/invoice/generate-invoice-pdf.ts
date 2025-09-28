import { currencyWithSymbol } from '@gauzy/utils';
import { IInvoice, IOrganization, IOrganizationContact, InvoiceTypeEnum } from '@gauzy/contracts';
import * as moment from 'moment-timezone';

export async function generateInvoicePdfDefinition(
	invoice: IInvoice,
	organization: IOrganization,
	organizationContact: IOrganizationContact,
	translatedText?: any,
	language?: string,
	country?: string
) {
	const body = [];
	for (const item of invoice.invoiceItems) {
		const currentItem = [
			`${item.description}`,
			`${item.quantity}`,
			currencyWithSymbol(item.price, invoice.currency ?? item.currency),
			currencyWithSymbol(item.totalValue, invoice.currency ?? item.currency)
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
	const tableHeader = [
		{ text: translatedText.item, bold: true },
		{ text: translatedText.quantity, bold: true },
		{ text: translatedText.price, bold: true },
		{ text: translatedText.totalValue, bold: true }
	];

	const tableBody: any[] = [];

	// TaxId
	const taxId = invoice.toOrganization?.taxId ?? organization.taxId;
	if (taxId) {
		tableBody.push([{ text: `${translatedText.taxId}:`, bold: true }, { text: taxId }]);
	}

	// Address + City + Country
	const address =
		invoice.toOrganization?.contact?.address ??
		organizationContact?.contact?.address ??
		organization?.contact?.address;

	const city =
		invoice.toOrganization?.contact?.city ?? organizationContact?.contact?.city ?? organization?.contact?.city;

	const showCountry =
		invoice.toOrganization?.contact?.country ??
		organizationContact?.contact?.country ??
		organization?.contact?.country;

	if (address || city || showCountry) {
		let addressLine = '';

		if (address) {
			addressLine += address;
		}

		if (city) {
			addressLine += (address ? ', ' : '') + city;
		}

		if (showCountry) {
			addressLine += (city || address ? ', ' : '') + country;
		}

		tableBody.push([{ text: `${translatedText.address}:`, bold: true }, { text: addressLine }]);
	}

	// Address2
	const address2 =
		invoice.toOrganization?.contact?.address2 ??
		organizationContact?.contact?.address2 ??
		organization?.contact?.address2;
	if (address2) {
		tableBody.push([{ text: `${translatedText.address2}:`, bold: true }, { text: address2 }]);
	}

	// Postcode
	const postcode =
		invoice.toOrganization?.contact?.postcode ??
		organizationContact?.contact?.postcode ??
		organization?.contact?.postcode;
	if (postcode) {
		tableBody.push([{ text: `${translatedText.postcode}:`, bold: true }, { text: postcode }]);
	}
	const stack: any[] = [
		{ bold: true, text: `${translatedText.to}:\n` },
		{
			text: `${invoice.toOrganization?.name ?? organizationContact?.name ?? organization.name}`,
			margin: [0, 0, 0, 5]
		}
	];

	if (tableBody.length) {
		stack.push({
			table: {
				widths: ['auto', '*'],
				body: tableBody
			},
			layout: 'noBorders'
		});
	}

	const showCurrencies = displayCurrencies(invoice);

	const resultDataToDisplay = invoiceResultDataToDisplay(invoice);

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
							`${moment(invoice.invoiceDate)
								.tz(invoice.fromUser?.timeZone ?? organization.timeZone)
								.format(organization.dateFormat)}`
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
							`${moment(invoice.dueDate).format(organization.dateFormat)}`
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
								text: `${
									invoice?.amounts?.length > 1 ? translatedText.currencies : translatedText.currency
								}: `
							},
							`${showCurrencies}`
						]
					}
				]
			},
			' ',
			{
				stack
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
						return rowIndex === 0 ? '#E6E6E6' : null;
					},
					defaultBorder: false,
					border: [false, false, false, false]
				}
			},
			' ',
			' ',
			{
				table: {
					widths: ['60%', '20%', '20%'],
					body: resultDataToDisplay.flatMap((amt) => {
						const rows: any[] = [
							[
								invoice.terms?.length > 0
									? {
											rowSpan: 7,
											alignment: 'top',
											columns: [
												{
													width: '*',
													text: [
														{ bold: true, text: `${translatedText.notes}\n\n` },
														`${invoice.terms}`
													]
												}
											]
									  }
									: '',
								{ bold: true, alignment: 'right', text: `${translatedText.taxValue}:` },
								{
									alignment: 'right',
									text:
										invoice.taxType === 'PERCENT'
											? `${amt.tax}%`
											: currencyWithSymbol(amt.tax, amt.currency)
								}
							],
							[
								'',
								{ bold: true, alignment: 'right', text: `${translatedText.taxValue} 2:` },
								{
									alignment: 'right',
									text:
										invoice.tax2Type === 'PERCENT'
											? `${amt.tax2}%`
											: currencyWithSymbol(amt.tax2, amt.currency)
								}
							],
							[
								'',
								{ bold: true, alignment: 'right', text: `${translatedText.discountValue}:` },
								{
									alignment: 'right',
									text:
										invoice.discountType === 'PERCENT'
											? `${amt.discountValue}%`
											: currencyWithSymbol(amt.discountValue, amt.currency)
								}
							],
							[
								'',
								{
									bold: true,
									alignment: 'right',
									fillColor: '#E6E6E6',
									text: `${translatedText.totalValue.toUpperCase()}:`
								},
								{
									bold: true,
									alignment: 'right',
									fillColor: '#E6E6E6',
									text: currencyWithSymbol(amt.totalValue, amt.currency)
								}
							],
							['', '', '']
						];

						if (invoice.hasRemainingAmountInvoiced) {
							rows.push(
								[
									'',
									{ bold: true, alignment: 'right', text: `${translatedText.alreadyPaid}:` },
									{ alignment: 'right', text: currencyWithSymbol(amt.alreadyPaid, amt.currency) }
								],
								[
									'',
									{ bold: true, alignment: 'right', text: `${translatedText.amountDue}:` },
									{ alignment: 'right', text: currencyWithSymbol(amt.amountDue, amt.currency) }
								]
							);
						}

						return rows;
					})
				},
				layout: {
					defaultBorder: false,
					border: [false, false, false, false]
				}
			}
		]
	};
	return docDefinition;
}

function invoiceResultDataToDisplay(invoice): {
	currency: string;
	totalValue: number;
	tax: number;
	tax2: number;
	discountValue: number;
	alreadyPaid: number;
	amountDue: number;
}[] {
	if (!invoice) return [];
	if (invoice.currency != null) {
		return [
			{
				currency: invoice.currency,
				totalValue: invoice.totalValue ?? 0,
				tax: invoice.tax ?? 0,
				tax2: invoice.tax2 ?? 0,
				discountValue: invoice.discountValue ?? 0,
				alreadyPaid: invoice.alreadyPaid ?? 0,
				amountDue: invoice.amountDue ?? 0
			}
		];
	}

	if (invoice.amounts?.length > 0) {
		return invoice.amounts.map((a) => ({
			currency: a.currency,
			totalValue: a.totalValue ?? 0,
			tax: invoice.tax ?? 0,
			tax2: invoice.tax2 ?? 0,
			discountValue: invoice.discountValue ?? 0,
			alreadyPaid: invoice.alreadyPaid ?? 0,
			amountDue: invoice.amountDue ?? 0
		}));
	}

	return [
		{
			currency: '',
			totalValue: 0,
			tax: 0,
			tax2: 0,
			discountValue: 0,
			alreadyPaid: 0,
			amountDue: 0
		}
	];
}

function displayCurrencies(invoice): string {
	if (!invoice) return '';
	if (invoice.currency) return invoice.currency;
	if (invoice.amounts?.length) {
		return invoice.amounts.map((a) => a.currency).join(', ');
	}
	return '';
}
