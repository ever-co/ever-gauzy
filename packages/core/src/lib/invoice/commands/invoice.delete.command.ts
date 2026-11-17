import { ICommand } from '@nestjs/cqrs';

export class InvoiceDeleteCommand implements ICommand {
	static readonly type = '[Invoice] Delete';

	/**
	 * @param invoiceId The invoice.
	 * @param expectedUpdatedAt The `updatedAt` the caller read the invoice with (`DELETE /invoices/:id?expectedUpdatedAt=`
	 * and GraphQL `deleteInvoice`): stated, the invoice is deleted only while it still holds it (see
	 * `InvoiceService.deleteUnchangedSince`); null, it is deleted as it always was.
	 */
	constructor(
		public readonly invoiceId: string,
		public readonly expectedUpdatedAt: Date | null = null
	) {}
}
