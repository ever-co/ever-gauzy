import { IInvoiceCreateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InvoiceCreateCommand implements ICommand {
	static readonly type = '[Invoice] Create';

	constructor(public readonly input: IInvoiceCreateInput) {}
}
