import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoicePaymentGeneratePdfCommand } from '../invoice-payment.generate.pdf.command';

@CommandHandler(InvoicePaymentGeneratePdfCommand)
export class InvoicePaymentGeneratePdfHandler
	implements ICommandHandler<InvoicePaymentGeneratePdfCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	public async execute(
		command: InvoicePaymentGeneratePdfCommand
	): Promise<Buffer> {
		const { invoiceId, locale } = command;
		return await this.invoiceService.generateInvoicePaymentPdf(
			invoiceId,
			locale
		);
	}
}
