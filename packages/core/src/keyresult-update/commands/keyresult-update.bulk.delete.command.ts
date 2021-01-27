import { ICommand } from '@nestjs/cqrs';

export class KeyResultUpdateBulkDeleteCommand implements ICommand {
	static readonly type = '[KeyResultUpdate] Delete';

	constructor(public readonly id: string) {}
}
