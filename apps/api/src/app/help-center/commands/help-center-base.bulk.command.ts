import { ICommand } from '@nestjs/cqrs';

export class KnowledgeBaseBulkDeleteCommand implements ICommand {
	static readonly type = '[KnowledgeBase] Delete';

	constructor(public readonly id: string) {}
}
