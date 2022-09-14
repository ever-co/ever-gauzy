import { IEstimateEmail, IInvoiceUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class PublicInvoiceUpdateCommand implements ICommand {
	static readonly type = '[Public Invoice] Update';

	constructor(
		public readonly params: IEstimateEmail,
		public readonly entity: IInvoiceUpdateInput
	) {}
}
