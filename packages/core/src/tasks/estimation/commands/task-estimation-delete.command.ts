import { ICommand } from '@nestjs/cqrs';

export class TaskEstimationDeleteCommand implements ICommand {
	static readonly type = '[Task Estimation] Delete Task Estimation';

	constructor(public readonly id: string) {}
}
