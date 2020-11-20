import { ICommand } from '@nestjs/cqrs';

export class InvoiceDeleteCommand implements ICommand {
	static readonly type = '[Invoice] Delete';

	constructor(public readonly invoiceId: string) {}
}
