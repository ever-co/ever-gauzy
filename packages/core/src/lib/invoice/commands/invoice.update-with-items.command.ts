import { IInvoiceItemCreateInput, IInvoiceUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IInvoicePrecondition } from '../invoice-precondition';

/** An invoice's fields and all its lines, saved together (`PUT /invoices/:id/with-items`). */
export class InvoiceUpdateWithItemsCommand implements ICommand {
	static readonly type = '[Invoice] Update With Items';

	constructor(
		public readonly input: IInvoiceUpdateInput & IInvoicePrecondition & { invoiceItems: IInvoiceItemCreateInput[] }
	) {}
}
