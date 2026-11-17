import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { InvoiceService } from '../../invoice.service';
import { InvoiceDeleteCommand } from '../invoice.delete.command';

@CommandHandler(InvoiceDeleteCommand)
export class InvoiceDeleteHandler implements ICommandHandler<InvoiceDeleteCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	/**
	 * Deletes the invoice. A delete that states `expectedUpdatedAt` deletes it only while the invoice still holds it (409
	 * otherwise, nothing deleted); one that does not deletes it as it always did.
	 */
	public async execute(command: InvoiceDeleteCommand): Promise<DeleteResult> {
		const { invoiceId, expectedUpdatedAt } = command;
		if (expectedUpdatedAt) {
			return await this.invoiceService.deleteUnchangedSince(invoiceId, expectedUpdatedAt);
		}
		return this.invoiceService.delete(invoiceId);
	}
}
