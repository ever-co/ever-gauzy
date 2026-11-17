import { IInvoiceItemCreateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InvoiceItemBulkCreateCommand implements ICommand {
	static readonly type = '[InvoiceItem] Create';

	/**
	 * @param invoiceId The invoice whose lines are replaced.
	 * @param input The new lines.
	 * @param expectedUpdatedAt The `updatedAt` the invoice was read with: the lines are replaced only while it still
	 * holds it. Null or left out, they are replaced as they always were.
	 */
	constructor(
		public readonly invoiceId: string,
		public readonly input: IInvoiceItemCreateInput[],
		public readonly expectedUpdatedAt: Date | null = null
	) {}
}
