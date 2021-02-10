import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KnowledgeBaseArticleBulkDeleteCommand } from '..';
import { HelpCenterAuthorService } from '../../help-center-author.service';

@CommandHandler(KnowledgeBaseArticleBulkDeleteCommand)
export class KnowledgeBaseArticleBulkDeleteHandler
	implements ICommandHandler<KnowledgeBaseArticleBulkDeleteCommand> {
	constructor(
		private readonly helpCenterAuthorService: HelpCenterAuthorService
	) {}

	public async execute(
		command: KnowledgeBaseArticleBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const authors = await this.helpCenterAuthorService.findByArticleId(id);
		await this.helpCenterAuthorService.deleteBulkByArticleId(
			authors.map((item) => item.id)
		);
		return;
	}
}
