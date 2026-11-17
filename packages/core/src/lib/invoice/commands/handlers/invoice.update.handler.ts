import { IInvoice } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvoiceService } from '../../invoice.service';
import { withoutReleasedTimeMark } from '../../invoice-final-status';
import { expectedUpdatedAtOf } from '../../invoice-precondition';
import { InvoiceUpdateCommand } from '../invoice.update.command';

@CommandHandler(InvoiceUpdateCommand)
export class InvoiceUpdateHandler implements ICommandHandler<InvoiceUpdateCommand> {
	constructor(private readonly invoiceService: InvoiceService) {}

	/**
	 * Writes the change. One that states `expectedUpdatedAt` is written only while the invoice still holds it (409
	 * otherwise, nothing written); one that does not is written as it always was. A status action moves the invoice's
	 * `updatedAt` either way (see `IInvoiceUpdateOptions.isAction`).
	 */
	public async execute(command: InvoiceUpdateCommand): Promise<IInvoice> {
		// The mark of released time billed since is written by the billing only, never by an update's input
		const { expectedUpdatedAt, ...input } = withoutReleasedTimeMark(command.input);
		const { id } = input;
		const change = { ...input, id };
		const expected = expectedUpdatedAtOf(expectedUpdatedAt);
		if (expected) {
			return await this.invoiceService.updateUnchangedSince(change, expected);
		}
		if (command.options?.isAction) {
			return await this.invoiceService.writeActionMovingUpdatedAt(change);
		}
		return await this.invoiceService.writeKeepingFinalStatus(change, (service) => service.create(change));
	}
}
