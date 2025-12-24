import { ICommand } from '@nestjs/cqrs';
import { BulkPluginPlanOperationDTO } from '../../../shared';

export class BulkPluginPlanOperationCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Plan] Bulk Operation';

	constructor(public readonly operationDto: BulkPluginPlanOperationDTO) {}
}
