import { PdfmakerService } from './pdfmaker.service';

/**
 * Invoice / estimate PDFs are built in memory from pdfkit's stream events.
 *
 * The previous implementation wrote every PDF to the same file path (the name was fixed when the
 * singleton service was constructed), unlinked it after reading, and swallowed errors into an
 * `undefined` result, on which the download endpoints returned without answering: repeating a
 * print hung the request. These cover the three paths that replaced it.
 */
describe('PdfmakerService', () => {
	const service = new PdfmakerService();
	const invoice = (n: number) => ({
		watermark: { text: 'DRAFT' },
		content: [{ text: `Invoice #${n}` }, { table: { body: [['Item', 'Qty'], ['Widget', '1']] } }]
	});
	const isPdf = (buffer: Buffer) =>
		buffer.subarray(0, 5).toString() === '%PDF-' && buffer.subarray(-8).toString().includes('%%EOF');

	it('returns a complete PDF document', async () => {
		const pdf = await service.generatePdf(invoice(1));

		expect(Buffer.isBuffer(pdf)).toBe(true);
		expect(isPdf(pdf)).toBe(true);
	});

	it('generates concurrent documents independently', async () => {
		const pdfs = await Promise.all(Array.from({ length: 10 }, (_, i) => service.generatePdf(invoice(i))));

		expect(pdfs.every(isPdf)).toBe(true);
	});

	it('rejects instead of resolving nothing when generation fails', async () => {
		await expect(service.generatePdf({ content: [{ image: 'not-an-image' }] })).rejects.toBeDefined();
	});
});
