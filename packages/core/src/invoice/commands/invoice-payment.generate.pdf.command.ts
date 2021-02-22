import { ICommand } from '@nestjs/cqrs';

export class InvoicePaymentGeneratePdfCommand implements ICommand {
	static readonly type = '[Invoice Payment] Generate Pdf';

	constructor(
		public readonly invoiceId: string,
		public readonly locale: string
	) {}
}
