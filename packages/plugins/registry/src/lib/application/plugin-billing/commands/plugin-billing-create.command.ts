import { ICommand } from '@nestjs/cqrs';
import { IPluginBillingCreateInput } from '../../../shared';

/**
 * Command for creating a new plugin billing record
 */
export class PluginBillingCreateCommand implements ICommand {
	static readonly type = '[PluginBilling] Create';

	constructor(public readonly input: IPluginBillingCreateInput) {}
}
