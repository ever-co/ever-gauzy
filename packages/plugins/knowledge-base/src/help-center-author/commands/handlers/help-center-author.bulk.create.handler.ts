import { IHelpCenterAuthor } from '@gauzy/contracts';
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
		const { input } = command;
		const { articleId, employeeIds, organizationId, tenantId } = input;

		let author: IHelpCenterAuthor;
		const createInput: IHelpCenterAuthor[] = [];

		for (const employeeId of employeeIds) {
			author = {
				articleId: articleId,
				employeeId: employeeId,
				organizationId,
				tenantId
			};
			createInput.push(author);
		}
		return await this.helpCenterAuthorService.createBulk(createInput);
	}
}
