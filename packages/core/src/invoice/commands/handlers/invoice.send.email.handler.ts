import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceSendEmailCommand } from '../invoice.send.email.command';

@CommandHandler(InvoiceSendEmailCommand)
export class InvoiceSendEmailHandler
	implements ICommandHandler<InvoiceSendEmailCommand> {

	constructor(
		private readonly invoiceService: InvoiceService
	) {}

	public async execute(command: InvoiceSendEmailCommand): Promise<any> {
		const { languageCode, email, params, originUrl } = command;
		return this.invoiceService.sendEmail(
			languageCode,
			email,
			params.invoiceNumber,
			params.invoiceId,
			params.isEstimate,
			originUrl,
			params.organizationId
		);
	}
}
