import { Injectable } from '@nestjs/common';
import * as PdfPrinter from 'pdfmake';

@Injectable()
export class PdfmakerService {
	private fonts: any = {
		Helvetica: {
			normal: 'Helvetica',
			bold: 'Helvetica-Bold',
			italics: 'Helvetica-Oblique',
			bolditalics: 'Helvetica-BoldOblique'
		}
	};

	/*
	 * Generate Invoice/Estimate Pdf
	 */
	async generatePdf(docDefinition): Promise<Buffer> {
		const printer = new PdfPrinter(this.fonts);
		const pdfDefinition = {
			watermark: docDefinition['watermark'],
			content: docDefinition['content'],
			defaultStyle: {
				font: 'Helvetica'
			}
		};

		return new Promise<Buffer>((resolve, reject) => {
			const pdfDoc = printer.createPdfKitDocument(pdfDefinition, {});
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
