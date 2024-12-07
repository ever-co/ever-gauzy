import { IInvoice } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { PublicInvoiceUpdateCommand } from '../public-invoice-update.command';
import { PublicInvoiceService } from './../../public-invoice.service';

@CommandHandler(PublicInvoiceUpdateCommand)
export class PublicInvoiceUpdateHandler implements ICommandHandler<PublicInvoiceUpdateCommand> {

	constructor(
		private readonly publicInvoiceService: PublicInvoiceService
	) {}

	public async execute(command: PublicInvoiceUpdateCommand): Promise<IInvoice | UpdateResult> {
		const { params, entity } = command;
		return await this.publicInvoiceService.updateInvoice(params, entity);
	}
}
