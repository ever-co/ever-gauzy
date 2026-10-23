import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceSendEmailCommand } from '../invoice.send.email.command';

@CommandHandler(InvoiceSendEmailCommand)
export class InvoiceSendEmailHandler
	implements ICommandHandler<InvoiceSendEmailCommand> {

	constructor(
		private readonly invoiceService: InvoiceService
	) { }

	public async execute(command: InvoiceSendEmailCommand): Promise<void> {
		const { languageCode, email, params, origin } = command;
		const { invoiceNumber, invoiceId, isEstimate, organizationId } = params;

		// The outcome is for in-process callers (an order quote reports it); the e-mail route answers no body,
		// as it always has, and the service has logged a failure.
		await this.invoiceService.sendEmail(
			languageCode,
			email,
			invoiceNumber,
			invoiceId,
			isEstimate,
			origin,
			organizationId
		);
	}
}
