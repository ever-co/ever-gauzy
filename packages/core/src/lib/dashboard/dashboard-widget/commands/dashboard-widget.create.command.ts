import { ICommand } from '@nestjs/cqrs';
import { IDashboardWidgetCreateInput } from '@gauzy/contracts';

export class DashboardWidgetCreateCommand implements ICommand {
	static readonly type = '[DashboardWidget] Create';

	constructor(public readonly input: IDashboardWidgetCreateInput) {}
}
