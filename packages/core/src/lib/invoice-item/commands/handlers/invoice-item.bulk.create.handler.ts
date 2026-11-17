import { ModuleRef } from '@nestjs/core';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../../invoice/invoice.service';
import { InvoiceChangedError } from '../../../invoice/invoice-precondition';
import { InvoiceItemBulkCreateCommand } from '../invoice-item.bulk.create.command';
import { InvoiceItemService } from '../../invoice-item.service';
import { InvoiceItem } from '../../invoice-item.entity';

@CommandHandler(InvoiceItemBulkCreateCommand)
export class InvoiceItemBulkCreateHandler implements ICommandHandler<InvoiceItemBulkCreateCommand> {
	constructor(
		private readonly invoiceItemService: InvoiceItemService,
		private readonly moduleRef?: ModuleRef
	) {}

	/**
	 * Replaces the invoice's lines. A replacement whose precondition no longer holds is answered 409 with the invoice
	 * as it is now, read by `InvoiceService` (`InvoiceModule`'s, which this module does not import).
	 */
	public async execute(command: InvoiceItemBulkCreateCommand): Promise<InvoiceItem[]> {
		const { invoiceId, input, expectedUpdatedAt } = command;
		try {
			return await this.invoiceItemService.createBulk(invoiceId, input, expectedUpdatedAt ?? null);
		} catch (error) {
			if (error instanceof InvoiceChangedError) {
				const invoiceService = this.moduleRef.get(InvoiceService, { strict: false });
				throw await invoiceService.invoiceChangedAnswer(error);
			}
			throw error;
		}
	}
}
