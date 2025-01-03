import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { InvoiceSendEmailCommand } from '../invoice.send.email.command';

@CommandHandler(InvoiceSendEmailCommand)
export class InvoiceSendEmailHandler
	implements ICommandHandler<InvoiceSendEmailCommand> {

	constructor(
		private readonly invoiceService: InvoiceService
	) { }

	public async execute(command: InvoiceSendEmailCommand): Promise<any> {
		const { languageCode, email, params, origin } = command;
		const { invoiceNumber, invoiceId, isEstimate, organizationId } = params;

		return await this.invoiceService.sendEmail(
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
