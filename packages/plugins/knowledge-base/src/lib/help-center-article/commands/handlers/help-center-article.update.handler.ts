import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
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

		// Check if content fields are being updated (versioning needed)
		const isContentUpdate = 'descriptionHtml' in input || 'descriptionJson' in input;

		if (isContentUpdate) {
			// Get current user's employee ID for version ownership
			const employeeId = RequestContext.currentEmployeeId();

			if (employeeId) {
				// Create version snapshot before updating
				await this.helpCenterArticle.updateWithVersioning(id, input, employeeId);
			} else {
				// No employee context, just update without versioning
				await this.helpCenterArticle.updateArticleById(id, input);
			}
		} else {
			// Metadata update (no versioning needed)
			await this.helpCenterArticle.updateArticleById(id, input);
		}
	}
}
