import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceGenerateLinkCommand } from '../invoice.generate.link.command';

@CommandHandler(InvoiceGenerateLinkCommand)
export class InvoiceGenerateLinkHandler
	implements ICommandHandler<InvoiceGenerateLinkCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	public async execute(command: InvoiceGenerateLinkCommand): Promise<any> {
		const { invoiceId, isEstimate } = command;
		return this.invoiceService.generateLink(
			invoiceId,
			isEstimate.isEstimate
		);
	}
}
