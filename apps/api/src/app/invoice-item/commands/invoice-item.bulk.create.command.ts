import { IInvoiceItemCreateInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class InvoiceItemBulkCreateCommand implements ICommand {
	static readonly type = '[InvoiceItem] Create';

	constructor(
		public readonly id: string,
		public readonly input: IInvoiceItemCreateInput[]
	) {}
}
