import { ICommand } from '@nestjs/cqrs';

export class KnowledgeBaseArticleBulkDeleteCommand implements ICommand {
	static readonly type = '[KnowledgeBaseArticle] Delete';

	constructor(public readonly id: string) {}
}
