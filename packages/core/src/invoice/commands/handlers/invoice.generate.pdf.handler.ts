import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceGeneratePdfCommand } from './../invoice.generate.pdf.command';

@CommandHandler(InvoiceGeneratePdfCommand)
export class InvoiceGeneratePdfHandler
	implements ICommandHandler<InvoiceGeneratePdfCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	public async execute(command: InvoiceGeneratePdfCommand): Promise<any> {
		const { invoiceId, isEstimate } = command;
		return this.invoiceService.generateLink(
			invoiceId,
			isEstimate.isEstimate
		);
	}
}
