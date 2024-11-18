import { IInvoiceItemCreateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InvoiceItemBulkCreateCommand implements ICommand {
	static readonly type = '[InvoiceItem] Create';

	constructor(
		public readonly invoiceId: string,
		public readonly input: IInvoiceItemCreateInput[]
	) {}
}
