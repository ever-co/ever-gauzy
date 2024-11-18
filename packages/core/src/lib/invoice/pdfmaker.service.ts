import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as PdfPrinter from 'pdfmake';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@gauzy/config';

@Injectable()
export class PdfmakerService {
	private readonly public_path: string;
	private _dirname: string;
	private _basename = '/invoices/pdf/';
	private fonts: any = {
		Helvetica: {
			normal: 'Helvetica',
			bold: 'Helvetica-Bold',
			italics: 'Helvetica-Oblique',
			bolditalics: 'Helvetica-BoldOblique'
		}
	};

	private _fileName: string = `document-${uuidv4()}`;
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

			let filename = `${this.filename}.pdf`;
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
					Buffer.concat(chunks);
					if (!Buffer?.length) return reject(new Error('PDF generation failed'));
					try {
						//convert pdf to Buffer
						const pdf = await new Promise<Buffer>((resolve, reject) => {
							try {
								fs.readFile(filePath, {}, (err, data) => {
									if (err) {
										reject(err);
									} else {
										//unlink after read pdf into Buffer form
										if (fs.existsSync(filePath)) {
											fs.unlinkSync(filePath);
										}
										resolve(data);
									}
								});
							} catch (err) {
								reject(err);
							}
						});
						resolve(pdf);
					} catch (err) {
						reject(err);
					}
				});
				pdfDoc.end();
			});
		} catch (e) {
			console.log(e);
		}
	}
}
