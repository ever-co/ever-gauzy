import { ICommand } from '@nestjs/cqrs';

export class InvoiceGenerateLinkCommand implements ICommand {
	static readonly type = '[Invoice] Generate Link';

	constructor(
		public readonly invoiceId: string
	) {}
}
