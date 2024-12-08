import { ICommand } from '@nestjs/cqrs';
import { ID, IScreeningTaskUpdateInput } from '@gauzy/contracts';

export class ScreeningTaskUpdateCommand implements ICommand {
	static readonly type = '[ScreeningTask] Update';

	constructor(public readonly id: ID, public readonly input: IScreeningTaskUpdateInput) {}
}
