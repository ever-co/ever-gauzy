import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceItemBulkCreateCommand } from '../invoice-item.bulk.create.command';
import { InvoiceItemService } from '../../invoice-item.service';
import { InvoiceItem } from '../../invoice-item.entity';

@CommandHandler(InvoiceItemBulkCreateCommand)
export class InvoiceItemBulkCreateHandler
	implements ICommandHandler<InvoiceItemBulkCreateCommand> {
	constructor(private readonly invoiceItemService: InvoiceItemService) {}

	public async execute(
		command: InvoiceItemBulkCreateCommand
	): Promise<InvoiceItem[]> {
		const { invoiceId, input } = command;
		return await this.invoiceItemService.createBulk(invoiceId, input);
	}
}
