import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

	describe('resource access (pdfmake 0.3 reads files and URLs a document names)', () => {
		// A valid 1x1 PNG
		const PNG = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
			'base64'
		);
		let dir: string;
		let file: string;

		beforeAll(() => {
			dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfmaker-'));
			file = path.join(dir, 'logo.png');
			fs.writeFileSync(file, PNG);
		});
		afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

		it('embeds an image given as a data URL', async () => {
			const pdf = await service.generatePdf({ content: [{ image: `data:image/png;base64,${PNG.toString('base64')}` }] });

			expect(isPdf(pdf)).toBe(true);
		});

		it('refuses to read a local file named in the document, even a valid image', async () => {
			await expect(service.generatePdf({ content: [{ image: file }] })).rejects.toThrow(
				/Access to local file denied/
			);
		});

		it('refuses to fetch a URL named in the document', async () => {
			const fetchSpy = jest.spyOn(globalThis, 'fetch');
			try {
				await expect(
					service.generatePdf({ content: [{ image: 'http://169.254.169.254/latest/meta-data/' }] })
				).rejects.toThrow(/denied/);
				expect(fetchSpy).not.toHaveBeenCalled();
			} finally {
				fetchSpy.mockRestore();
			}
		});
	});
});
