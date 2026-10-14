import { Injectable } from '@nestjs/common';
import * as pdfmake from 'pdfmake';

/** pdfkit's built-in Helvetica, referenced by name (no font file). */
const FONTS = {
	Helvetica: {
		normal: 'Helvetica',
		bold: 'Helvetica-Bold',
		italics: 'Helvetica-Oblique',
		bolditalics: 'Helvetica-BoldOblique'
	}
};
/** pdfmake 0.3 checks font names against the local access policy too: these are the only ones a document needs. */
const FONT_NAMES: ReadonlySet<string> = new Set(Object.values(FONTS.Helvetica));

@Injectable()
export class PdfmakerService {
	constructor() {
		// pdfmake 0.3 is a module-wide instance configured through setters (0.2 had a printer per font set).
		pdfmake.setFonts(FONTS);
		// pdfmake 0.3 also downloads http(s) resources and reads local files named in a document. Invoices and estimates
		// need neither (their content is text and tables), and both would let document content reach the network or
		// the server's disk (CVE-2026-26801): deny every URL and every local path except the built-in font names.
		pdfmake.setUrlAccessPolicy(() => false);
		pdfmake.setLocalAccessPolicy((path: string) => FONT_NAMES.has(path));
	}

	/*
	 * Generate Invoice/Estimate Pdf
	 */
	async generatePdf(docDefinition): Promise<Buffer> {
		const pdfDefinition = {
			watermark: docDefinition['watermark'],
			content: docDefinition['content'],
			defaultStyle: {
				font: 'Helvetica'
			}
		};

		const pdfDoc = await pdfmake.createPdf(pdfDefinition, {}).getStream();
		return new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
			pdfDoc.on('error', reject);
			pdfDoc.on('end', () => {
				const pdf = Buffer.concat(chunks);
				if (!pdf.length) {
					return reject(new Error('PDF generation failed'));
				}
				resolve(pdf);
			});
			pdfDoc.end();
		});
	}
}
