import { ICommand } from '@nestjs/cqrs';

export class KeyResultBulkCreateCommand implements ICommand {
	static readonly type = '[KeyResult] Register';

	constructor(public readonly input: any[]) {}
}
