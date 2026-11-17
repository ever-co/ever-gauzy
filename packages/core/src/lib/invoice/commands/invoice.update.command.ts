import { IInvoiceUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IInvoicePrecondition } from '../invoice-precondition';

/** How an update of an invoice is made, besides what it writes. */
export interface IInvoiceUpdateOptions {
	/**
	 * A status action (`PUT /invoices/:id/action`, GraphQL `updateInvoiceAction`): void, paid, unpaid, sent and the
	 * like. It moves the invoice's `updatedAt` whatever it writes, so a precondition read before it sees it
	 * (ever-co/ever-teams#5382).
	 */
	isAction?: boolean;
}

export class InvoiceUpdateCommand implements ICommand {
	static readonly type = '[Invoice] Update';

	/**
	 * @param input The change, and the invoice it names. `expectedUpdatedAt`, when stated, makes the update conditional
	 * (see `IInvoicePrecondition`); `PUT /invoices/:id` and `PUT /invoices/:id/action` state it.
	 * @param options How the update is made (see `IInvoiceUpdateOptions`).
	 */
	constructor(
		public readonly input: IInvoiceUpdateInput & IInvoicePrecondition,
		public readonly options: IInvoiceUpdateOptions = {}
	) {}
}
