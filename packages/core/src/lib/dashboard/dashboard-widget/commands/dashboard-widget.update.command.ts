import { ICommand } from '@nestjs/cqrs';
import { ID, IDashboardWidgetUpdateInput } from '@gauzy/contracts';

export class DashboardWidgetUpdateCommand implements ICommand {
	static readonly type = '[DashboardWidget] Update';

	constructor(public readonly id: ID, public readonly input: IDashboardWidgetUpdateInput) {}
}
