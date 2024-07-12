import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HelpCenterUpdateArticleCommand } from '../help-center-article.update.command';
import { HelpCenterArticleService } from './../../help-center-article.service';

@CommandHandler(HelpCenterUpdateArticleCommand)
export class HelpCenterArticleUpdateHandler implements ICommandHandler<HelpCenterUpdateArticleCommand> {

	constructor(
		private readonly helpCenterArticle: HelpCenterArticleService
	) { }

	public async execute(
		command: HelpCenterUpdateArticleCommand
	): Promise<void> {
		const { id, input } = command;
		await this.helpCenterArticle.updateArticleById(id, input);
	}
}
