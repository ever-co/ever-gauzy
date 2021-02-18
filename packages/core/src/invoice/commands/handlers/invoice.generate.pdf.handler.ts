import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from './../../../invoice';
import { InvoiceGeneratePdfCommand } from './../invoice.generate.pdf.command';

@CommandHandler(InvoiceGeneratePdfCommand)
export class InvoiceGeneratePdfHandler
	implements ICommandHandler<InvoiceGeneratePdfCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	public async execute(command: InvoiceGeneratePdfCommand): Promise<any> {
		const { invoiceId, locale } = command;
		return await this.invoiceService.generatePdf(invoiceId, locale);
	}
}
