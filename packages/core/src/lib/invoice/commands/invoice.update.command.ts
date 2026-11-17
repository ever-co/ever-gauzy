import { IInvoiceUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IInvoicePrecondition } from '../invoice-precondition';

export class InvoiceUpdateCommand implements ICommand {
	static readonly type = '[Invoice] Update';

	/**
	 * @param input The change, and the invoice it names. `expectedUpdatedAt`, when stated, makes the update conditional
	 * (see `IInvoicePrecondition`); only `PUT /invoices/:id` states it.
	 */
	constructor(public readonly input: IInvoiceUpdateInput & IInvoicePrecondition) {}
}
