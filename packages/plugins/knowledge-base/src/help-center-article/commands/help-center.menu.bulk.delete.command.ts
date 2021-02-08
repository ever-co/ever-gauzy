import { ICommand } from '@nestjs/cqrs';

export class KnowledgeBaseCategoryBulkDeleteCommand implements ICommand {
	static readonly type = '[KnowledgeBaseCategory] Delete';

	constructor(public readonly id: string) {}
}
