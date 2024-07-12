import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/common';
import { HelpCenterArticleService } from './../../../help-center-article/help-center-article.service';
import { KnowledgeBaseCategoryBulkDeleteCommand } from '../help-center.menu.bulk.delete.command';

@CommandHandler(KnowledgeBaseCategoryBulkDeleteCommand)
export class KnowledgeBaseCategoryBulkDeleteHandler
	implements ICommandHandler<KnowledgeBaseCategoryBulkDeleteCommand> {
	constructor(private readonly helpCenterArticle: HelpCenterArticleService) {}

	public async execute(
		command: KnowledgeBaseCategoryBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const articles = await this.helpCenterArticle.getArticlesByCategoryId(
			id
		);
		const ids = articles.map((item) => item.id);
		if (isNotEmpty(ids)) {
			await this.helpCenterArticle.deleteBulkByCategoryId(ids);
		}
		return;
	}
}
