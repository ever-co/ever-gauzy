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

const organization = (currencyPosition?: string) =>
	({ name: 'Ever Co', dateFormat: 'YYYY-MM-DD', currencyPosition } as any);
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
});

describe('generateInvoicePaymentPdfDefinition', () => {
	const payments = [
		{ amount: 8, createdByUser: { name: 'Jane' }, note: null, overdue: false }
	] as any[];

	it('renders the total value and the total paid with the organization currency position', async () => {
		const right = await generateInvoicePaymentPdfDefinition(
			invoice(),
			payments,
			organization(CurrencyPosition.RIGHT),
			contact,
			8,
			translatedText
		);
		expect(texts(right)).toEqual(expect.arrayContaining(['108 USD', '8 USD']));

		const left = await generateInvoicePaymentPdfDefinition(
			invoice(),
			payments,
			organization(CurrencyPosition.LEFT),
			contact,
			8,
			translatedText
		);
		expect(texts(left)).toEqual(expect.arrayContaining(['USD 108', 'USD 8']));
	});
});
