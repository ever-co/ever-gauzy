import { IInvoice } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceGenerateLinkCommand } from '../invoice.generate.link.command';

@CommandHandler(InvoiceGenerateLinkCommand)
export class InvoiceGenerateLinkHandler
	implements ICommandHandler<InvoiceGenerateLinkCommand> {

	constructor(
		private readonly invoiceService: InvoiceService
	) {}

	public async execute(command: InvoiceGenerateLinkCommand): Promise<IInvoice> {
		try {
			const { invoiceId } = command;
			return await this.invoiceService.generateLink(invoiceId);
		} catch (error) {
			console.error('Error while genrating public link for invoice/estimate');
			throw new BadRequestException(error);
		}
	}
}
