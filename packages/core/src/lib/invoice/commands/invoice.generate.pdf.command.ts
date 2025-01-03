import { ICommand } from '@nestjs/cqrs';

export class InvoiceGeneratePdfCommand implements ICommand {
	static readonly type = '[Invoice] Generate Pdf';

	constructor(
		public readonly invoiceId: string,
		public readonly locale: string
	) {}
}
