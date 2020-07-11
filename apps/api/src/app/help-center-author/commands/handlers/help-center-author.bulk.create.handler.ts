import { IHelpCenterAuthor } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ArticleAuthorsBulkCreateCommand } from '..';
import { HelpCenterAuthorService } from '../../help-center-author.service';

@CommandHandler(ArticleAuthorsBulkCreateCommand)
export class ArticleAuthorsBulkCreateHandler
	implements ICommandHandler<ArticleAuthorsBulkCreateCommand> {
	constructor(
		private readonly helpCenterAuthorService: HelpCenterAuthorService
	) {}

	public async execute(
		command: ArticleAuthorsBulkCreateCommand
	): Promise<IHelpCenterAuthor[]> {
		const { articleId, employeeIds } = command;
		let author: IHelpCenterAuthor;
		const createInput: IHelpCenterAuthor[] = [];

		for (const employeeId of employeeIds) {
			author = { articleId: articleId, employeeId: employeeId };
			createInput.push(author);
		}
		return await this.helpCenterAuthorService.createBulk(createInput);
	}
}
