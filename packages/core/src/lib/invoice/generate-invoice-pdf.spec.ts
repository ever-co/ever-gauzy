import { CurrencyPosition, DiscountTaxTypeEnum, InvoiceTypeEnum } from '@gauzy/contracts';
import { generateInvoicePdfDefinition } from './generate-invoice-pdf';
import { generateInvoicePaymentPdfDefinition } from './generate-invoice-payment-pdf';

/**
 * The PDF definitions are plain pdfmake objects: these tests flatten every `text` they contain and
 * check how the amounts are rendered, so a regression in either generator (an amount that bypasses
 * the currency-position helper, a bare tax dressed up as a percentage) shows up here.
 */
const texts = (node: any): string[] => {
	if (node === null || node === undefined) {
		return [];
	}
	if (typeof node === 'string') {
		return [node];
	}
	if (Array.isArray(node)) {
		return node.flatMap(texts);
	}
	if (typeof node === 'object') {
		// Column widths are strings too ('25%'); they are layout, not content.
		return Object.entries(node)
			.filter(([key]) => key !== 'width' && key !== 'widths')
			.flatMap(([, value]) => texts(value));
	}
	return [];
};

const translatedText = {
	item: 'Item',
	description: 'Description',
	quantity: 'Quantity',
	price: 'Price',
	totalValue: 'Total Value',
	invoice: 'Invoice',
	estimate: 'Estimate',
	number: 'Number',
	from: 'From',
	to: 'To',
	date: 'Date',
	dueDate: 'Due Date',
	discountValue: 'Discount Value',
	discountType: 'Discount Type',
	taxValue: 'Tax Value',
	taxType: 'Tax Type',
	currency: 'Currency',
	terms: 'Terms',
	paid: 'Paid',
	yes: 'Yes',
	no: 'No',
	alreadyPaid: 'Already Paid',
	amountDue: 'Amount Due',
	paymentsForInvoice: 'Payments for invoice',
	receivedFrom: 'Received from',
	receiver: 'Receiver',
	totalPaid: 'Total Paid',
	paymentDate: 'Payment Date',
	amount: 'Amount',
	createdByUser: 'Recorded By',
	note: 'Note',
	status: 'Status',
	overdue: 'Overdue',
	onTime: 'On time'
};

const organization = (currencyPosition?: string, timeZone = 'UTC') =>
	({ name: 'Ever Co', dateFormat: 'YYYY-MM-DD', currencyPosition, timeZone } as any);
const contact = { name: 'ACME' } as any;

const invoice = (overrides: Record<string, any> = {}) =>
	({
		invoiceNumber: 42,
		invoiceDate: new Date('2026-10-01'),
		dueDate: new Date('2026-10-31'),
		currency: 'USD',
		invoiceType: InvoiceTypeEnum.DETAILED_ITEMS,
		invoiceItems: [{ description: 'Widget', quantity: 2, price: 50, totalValue: 100 }],
		tax: 10,
		taxType: DiscountTaxTypeEnum.PERCENT,
		tax2: 5,
		tax2Type: DiscountTaxTypeEnum.FLAT_VALUE,
		discountValue: 7,
		discountType: DiscountTaxTypeEnum.FLAT_VALUE,
		totalValue: 108,
		hasRemainingAmountInvoiced: true,
		alreadyPaid: 8,
		amountDue: 100,
		terms: 'Net 30',
		paid: false,
		isEstimate: false,
		...overrides
	} as any);

describe('generateInvoicePdfDefinition', () => {
	it('renders every amount with the currency on the right when the organization says so', async () => {
		const doc = await generateInvoicePdfDefinition(
			invoice(),
			organization(CurrencyPosition.RIGHT),
			contact,
			translatedText
		);
		const all = texts(doc);

		expect(all).toEqual(expect.arrayContaining(['50 USD', '100 USD', '5 USD', '7 USD']));
		expect(all).toContain('Total Value: 108 USD');
		expect(all).toContain('Already Paid: 8 USD');
		expect(all).toContain('Amount Due: 100 USD');
		expect(all.some((text) => /USD \d/.test(text))).toBe(false);
	});

	it('keeps the currency on the left by default and renders percentages as such', async () => {
		const doc = await generateInvoicePdfDefinition(invoice(), organization(), contact, translatedText);
		const all = texts(doc);

		expect(all).toEqual(expect.arrayContaining(['USD 50', 'USD 100', '10%', 'USD 5', 'USD 7']));
		expect(all).toContain('Total Value: USD 108');
	});

	it('leaves a tax or discount whose type was never set as a bare number', async () => {
		const doc = await generateInvoicePdfDefinition(
			invoice({ taxType: undefined, tax2Type: null, discountType: undefined }),
			organization(CurrencyPosition.RIGHT),
			contact,
			translatedText
		);
		const all = texts(doc);

		expect(all).toEqual(expect.arrayContaining(['10', '5', '7']));
		expect(all.some((text) => text.endsWith('%'))).toBe(false);
	});

	// #10690: the header dates used to print as `Thu Oct 01` (no year, server time zone), and a document
	// without a due date or a contact threw before the PDF was built.
	describe('header dates and contact', () => {
		// 5 and 31 October picked in a UTC+2 / UTC+1 browser are stored as the previous day, UTC.
		const dated = { invoiceDate: new Date('2026-10-04T22:00:00Z'), dueDate: new Date('2026-10-30T23:00:00Z') };
		const paris = { ...organization(undefined, 'Europe/Paris'), dateFormat: 'DD.MM.YYYY' };

		it.each([
			['an invoice', false, 'Invoice Date: '],
			['an estimate', true, 'Estimate Date: ']
		])(
			'prints the dates of %s as full days in the organization time zone and format',
			async (_, isEstimate, label) => {
				const all = texts(
					await generateInvoicePdfDefinition(
						invoice({ ...dated, isEstimate }),
						paris,
						contact,
						translatedText
					)
				);

				expect(all).toEqual(expect.arrayContaining([label, '05.10.2026', 'Due Date: ', '31.10.2026']));
			}
		);

		it('renders a document without a due date, printing that date empty', async () => {
			const all = texts(
				await generateInvoicePdfDefinition(
					invoice({ ...dated, isEstimate: true, dueDate: null }),
					paris,
					contact,
					translatedText
				)
			);

			expect(all).toContain('05.10.2026');
			expect(all[all.indexOf('Due Date: ') + 1]).toBe('');
		});

		it.each([null, undefined])('renders a document whose contact is %s', async (missing) => {
			const all = texts(await generateInvoicePdfDefinition(invoice(dated), paris, missing, translatedText));

			expect(all[all.indexOf('To:\n') + 1]).toBe('');
			expect(all).toContain('Total Value: USD 108');
		});
	});

	// A line's employee, project, task, product or expense is set to null when that record is deleted
	describe('lines whose item record is gone', () => {
		const line = { description: 'Work', quantity: 1, price: 108, totalValue: 108 };

		it.each([
			[InvoiceTypeEnum.BY_EMPLOYEE_HOURS, { employee: null }],
			[InvoiceTypeEnum.BY_EMPLOYEE_HOURS, { employee: { user: null } }],
			[InvoiceTypeEnum.BY_PROJECT_HOURS, { project: null }],
			[InvoiceTypeEnum.BY_TASK_HOURS, { task: null }],
			[InvoiceTypeEnum.BY_PRODUCTS, { product: null }],
			[InvoiceTypeEnum.BY_EXPENSES, { expense: null }]
		])('renders a %s invoice whose line has %o, with an empty item', async (invoiceType, relation) => {
			const doc = await generateInvoicePdfDefinition(
				invoice({ invoiceType, invoiceItems: [{ ...line, ...(relation as object) }] }),
				organization(),
				contact,
				translatedText,
				'en'
			);
			const [, row] = (doc.content.find((node: any) => node?.table) as any).table.body;

			expect(row).toEqual(['', 'Work', '1', 'USD 108', 'USD 108']);
		});

		it.each([
			[InvoiceTypeEnum.BY_EMPLOYEE_HOURS, { employee: { user: { name: 'Jane Doe' } } }, 'Jane Doe'],
			[InvoiceTypeEnum.BY_PROJECT_HOURS, { project: { name: 'Gauzy' } }, 'Gauzy'],
			[InvoiceTypeEnum.BY_TASK_HOURS, { task: { title: 'Fix PDF' } }, 'Fix PDF'],
			[InvoiceTypeEnum.BY_PRODUCTS, { product: { name: 'Widget', translations: [] } }, 'Widget'],
			[InvoiceTypeEnum.BY_EXPENSES, { expense: { purpose: 'Travel' } }, 'Travel']
		])('still prints the item of a %s line', async (invoiceType, relation, item) => {
			const doc = await generateInvoicePdfDefinition(
				invoice({ invoiceType, invoiceItems: [{ ...line, ...(relation as object) }] }),
				organization(),
				contact,
				translatedText,
				'en'
			);
			const [, row] = (doc.content.find((node: any) => node?.table) as any).table.body;

			expect(row[0]).toBe(item);
		});
	});
});

describe('generateInvoicePaymentPdfDefinition', () => {
	const payments = [
		{
			amount: 3,
			paymentDate: new Date('2026-10-05T12:00:00Z'),
			createdByUser: { name: 'Jane' },
			note: null,
			overdue: false
		},
		{
			amount: 5,
			paymentDate: new Date('2026-10-20T12:00:00Z'),
			createdByUser: { name: 'Joe' },
			note: 'wire',
			overdue: true
		}
	] as any[];

	it('renders each payment, the total value and the total paid with the organization currency position', async () => {
		const right = await generateInvoicePaymentPdfDefinition(
			invoice(),
			payments,
			organization(CurrencyPosition.RIGHT),
			contact,
			8,
			translatedText
		);
		expect(texts(right)).toEqual(expect.arrayContaining(['3 USD', '5 USD', '108 USD', '8 USD']));

		const left = await generateInvoicePaymentPdfDefinition(
			invoice(),
			payments,
			organization(CurrencyPosition.LEFT),
			contact,
			8,
			translatedText
		);
		expect(texts(left)).toEqual(expect.arrayContaining(['USD 3', 'USD 5', 'USD 108', 'USD 8']));
	});

	it('prints each payment\'s own date under "Payment Date", and the due date only in the header', async () => {
		const doc = await generateInvoicePaymentPdfDefinition(
			invoice(),
			payments,
			organization(),
			contact,
			8,
			translatedText
		);
		const all = texts(doc);

		expect(all).toEqual(expect.arrayContaining(['2026-10-05', '2026-10-20']));
		expect(all.filter((text) => text === '2026-10-31')).toHaveLength(1);
	});

	it('formats the dates as calendar days of the organization time zone', async () => {
		// 5 October picked in a UTC+2 browser is stored as the previous day, 22:00 UTC.
		const payment = { ...payments[0], paymentDate: new Date('2026-10-04T22:00:00Z') };

		const paris = await generateInvoicePaymentPdfDefinition(
			invoice(),
			[payment],
			organization(undefined, 'Europe/Paris'),
			contact,
			3,
			translatedText
		);
		expect(texts(paris)).toContain('2026-10-05');

		const utc = await generateInvoicePaymentPdfDefinition(
			invoice(),
			[payment],
			organization(undefined, 'UTC'),
			contact,
			3,
			translatedText
		);
		expect(texts(utc)).toContain('2026-10-04');
	});

	it('falls back to the recording date when a payment carries no payment date', async () => {
		const createdAt = new Date('2026-10-07T12:00:00Z');
		const doc = await generateInvoicePaymentPdfDefinition(
			invoice(),
			[{ ...payments[0], paymentDate: undefined, createdAt }],
			organization(),
			contact,
			3,
			translatedText
		);

		expect(texts(doc)).toContain('2026-10-07');
	});

	it('renders a payment without a recording user, with that column empty', async () => {
		const doc = await generateInvoicePaymentPdfDefinition(
			invoice(),
			[{ ...payments[0], createdByUser: null }],
			organization(),
			contact,
			3,
			translatedText
		);
		const [, row] = (doc.content.find((node: any) => node?.table) as any).table.body;

		expect(row[2]).toBe('');
		expect(texts(doc)).toContain('USD 3');
	});

	it.each([null, undefined])('renders the payments of an invoice whose contact is %s', async (missing) => {
		const all = texts(
			await generateInvoicePaymentPdfDefinition(invoice(), payments, organization(), missing, 8, translatedText)
		);

		expect(all[all.indexOf('Received from:\n') + 1]).toBe('');
		expect(all).toContain('Jane');
	});
});
