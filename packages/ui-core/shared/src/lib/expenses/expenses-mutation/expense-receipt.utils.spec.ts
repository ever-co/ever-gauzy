import { isPlaceholderReceipt, PLACEHOLDER_RECEIPT, toActualReceipt } from './expense-receipt.utils';

const UPLOADED = 'https://files.example.com/attach_receipts/2026/10/receipt-42.png';

describe('isPlaceholderReceipt — the sample invoice is not a receipt', () => {
	it.each([
		['the path the form pre-filled', PLACEHOLDER_RECEIPT],
		['a root-relative path', '/assets/images/others/invoice-template.png'],
		['a bare relative path', 'assets/images/others/invoice-template.png'],
		['a full app URL', 'https://app.example.com/assets/images/others/invoice-template.png'],
		['the path with stray whitespace', ` ${PLACEHOLDER_RECEIPT} `]
	])('recognises %s', (_case, receipt) => {
		expect(isPlaceholderReceipt(receipt)).toBe(true);
	});

	it.each([
		['an uploaded receipt', UPLOADED],
		[
			'a receipt that merely shares the file name',
			'https://files.example.com/attach_receipts/invoice-template.png'
		],
		['an empty string', ''],
		['null', null],
		['undefined', undefined]
	])('does not mistake %s for it', (_case, receipt) => {
		expect(isPlaceholderReceipt(receipt)).toBe(false);
	});
});

describe('toActualReceipt — what the expense form shows and saves as the receipt', () => {
	it('keeps an uploaded receipt', () => {
		expect(toActualReceipt(UPLOADED)).toBe(UPLOADED);
	});

	it('reads an expense saved with the sample invoice as having no receipt', () => {
		expect(toActualReceipt(PLACEHOLDER_RECEIPT)).toBeNull();
	});

	it.each([[null], [undefined], ['']])('gives null for %p', (receipt) => {
		expect(toActualReceipt(receipt)).toBeNull();
	});
});
