import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as PdfPrinter from 'pdfmake';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@gauzy/config';

@Injectable()
export class PdfmakerService {
	private readonly logger = new Logger(`GZY - ${PdfmakerService.name}`);

	private readonly public_path: string;
	private readonly _dirname: string;
	private readonly _basename = '/invoices/pdf/';
	private readonly fonts = {
		Helvetica: {
			normal: 'Helvetica',
			bold: 'Helvetica-Bold',
			italics: 'Helvetica-Oblique',
			bolditalics: 'Helvetica-BoldOblique'
		}
	};

	private _fileName = `document-${uuidv4()}`;
	setFilename(filename: string) {
		this._fileName = filename;
		return this;
	}
	get filename(): string {
		return this._fileName;
	}

	constructor(private readonly configService: ConfigService) {
		this.public_path =
			this.configService.assetOptions.assetPublicPath || __dirname;
		this._dirname = path.join(this.public_path, this._basename);
	}

	/*
	 * Generate Invoice/Estimate Pdf
	 */
	async generatePdf(docDefinition): Promise<Buffer> {
		try {
			const printer = new PdfPrinter(this.fonts);
			const pdfDefinition = {
				watermark: docDefinition['watermark'],
				content: docDefinition['content'],
				defaultStyle: {
					font: 'Helvetica'
				}
			};

			if (!fs.existsSync(this._dirname)) {
				fs.mkdirSync(this._dirname, { recursive: true });
			}

			const filename = `${this.filename}.pdf`;
			const filePath = path.join(this._dirname, filename);

			return await new Promise<Buffer>((resolve, reject) => {
				const pdfDoc = printer.createPdfKitDocument(pdfDefinition, {});
				pdfDoc.pipe(fs.createWriteStream(filePath));

				const chunks = [];
				pdfDoc.on('readable', () => {
					let chunk: string;
					while ((chunk = pdfDoc.read()) !== null) {
						chunks.push(chunk);
					}
				});

				pdfDoc.on('end', async () => {
					const pdfBuffer = Buffer.concat(chunks);
					if (!pdfBuffer?.length) {
						this.logger.error('PDF generation failed. Generated buffer is empty.');
						return reject(new Error('PDF generation failed'));
					}
					resolve(pdfBuffer);

					try {
						//unlink after read pdf into Buffer form
						if (fs.existsSync(filePath)) {
							fs.unlinkSync(filePath);
						}
					} catch (error) {
						this.logger.error(`Error unlinking file ${filePath}: ${error}`);
					}
				});

				pdfDoc.end();
			});
		} catch (error) {
			this.logger.error(`Error generating PDF: ${error}`);
			throw error;
		}
	}
}
