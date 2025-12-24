import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ProcessBillingCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Process Billing';

	constructor(public readonly id: ID) {}
}
