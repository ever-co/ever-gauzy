import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { InvoiceService } from '../../invoice.service';
import { InvoiceDeleteCommand } from '../invoice.delete.command';

@CommandHandler(InvoiceDeleteCommand)
export class InvoiceDeleteHandler
	implements ICommandHandler<InvoiceDeleteCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	public async execute(command: InvoiceDeleteCommand): Promise<DeleteResult> {
		const { invoiceId } = command;
		return this.invoiceService.delete(invoiceId);
	}
}
