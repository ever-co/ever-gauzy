import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HelpCenterArticleService } from './../../../help-center-article/help-center-article.service';
import { KnowledgeBaseCategoryBulkDeleteCommand } from '../help-center.menu.bulk.delete.command';

@CommandHandler(KnowledgeBaseCategoryBulkDeleteCommand)
export class KnowledgeBaseCategoryBulkDeleteHandler implements ICommandHandler<KnowledgeBaseCategoryBulkDeleteCommand> {
	constructor(private readonly helpCenterArticle: HelpCenterArticleService) {}

	public async execute(command: KnowledgeBaseCategoryBulkDeleteCommand): Promise<void> {
		const { id: categoryId } = command;

		const articles = await this.helpCenterArticle.getArticlesByCategoryId(categoryId);

		if (!articles?.length) {
			return;
		}

		const articleIds = articles.map((article) => article.id);

		await this.helpCenterArticle.deleteMany(articleIds);
	}
}
