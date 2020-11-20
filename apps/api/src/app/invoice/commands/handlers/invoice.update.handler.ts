import { IInvoice } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceUpdateCommand } from '../invoice.update.command';

@CommandHandler(InvoiceUpdateCommand)
export class InvoiceUpdateHandler
	implements ICommandHandler<InvoiceUpdateCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	public async execute(command: InvoiceUpdateCommand): Promise<IInvoice> {
		const { input } = command;
		const { id } = input;
		return this.invoiceService.create({ id, ...input });
	}
}
