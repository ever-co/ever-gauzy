import { deepMerge } from '@gauzy/common';
import { Injectable } from '@nestjs/common';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

@Injectable()
export class PdfmakerService {
	vfs: any = pdfFonts.pdfMake.vfs;
	fonts: any = {
		Roboto: {
			normal: 'Roboto-Regular.ttf',
			bold: 'Roboto-Medium.ttf',
			italics: 'Roboto-Italic.ttf',
			bolditalics: 'Roboto-Italic.ttf'
		}
	};

	constructor() {
		pdfMake.vfs = pdfFonts.pdfMake.vfs;
	}

	registerFonts(fonts?: any) {
		if (fonts) {
			this.fonts = deepMerge(this.fonts, fonts);
		}
		return this;
	}

	generatePdf(docDefinition) {
		pdfMake.createPdf(docDefinition).download(`pdf-${new Date()}.pdf`);
	}
}
