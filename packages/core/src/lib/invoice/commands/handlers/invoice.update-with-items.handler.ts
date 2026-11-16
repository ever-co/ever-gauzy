import { IInvoice } from '@gauzy/contracts';
import { ModuleRef } from '@nestjs/core';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceItemService } from '../../../invoice-item/invoice-item.service';
import { InvoiceService } from '../../invoice.service';
import { withoutReleasedTimeMark } from '../../invoice-final-status';
import { expectedUpdatedAtOf } from '../../invoice-precondition';
import { InvoiceUpdateWithItemsCommand } from '../invoice.update-with-items.command';

@CommandHandler(InvoiceUpdateWithItemsCommand)
export class InvoiceUpdateWithItemsHandler implements ICommandHandler<InvoiceUpdateWithItemsCommand> {
	/** Resolved on first use: the lines' service is `InvoiceItemModule`'s, which this module does not import. */
	private invoiceItemService?: InvoiceItemService;

	constructor(
		private readonly invoiceService: InvoiceService,
		private readonly moduleRef: ModuleRef
	) {}

	/**
	 * Writes the invoice's fields and replaces its lines in one transaction, under the precondition when one is
	 * stated: a save that fails, or is refused, writes neither.
	 */
	public async execute(command: InvoiceUpdateWithItemsCommand): Promise<IInvoice> {
		// The mark of released time billed since is written by the billing only, never by an update's input
		const { expectedUpdatedAt, invoiceItems, ...input } = withoutReleasedTimeMark(command.input);
		const { id } = input;
		const change = { ...input, id };
		const expected = expectedUpdatedAtOf(expectedUpdatedAt);
		// Every line is one of this invoice: the route names the invoice, a line cannot move to another one
		const lines = (invoiceItems ?? []).map((line) => ({ ...line, invoiceId: id }));
		return await this.invoiceService.updateWithItems(change, lines, expected, this.lines());
	}

	private lines(): InvoiceItemService {
		this.invoiceItemService ??= this.moduleRef.get(InvoiceItemService, { strict: false });
		return this.invoiceItemService;
	}
}
