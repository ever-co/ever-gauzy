import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KnowledgeBaseBulkDeleteCommand } from '..';
import { HelpCenterService } from '../../help-center.service';

@CommandHandler(KnowledgeBaseBulkDeleteCommand)
export class KnowledgeBaseBulkDeleteHandler
	implements ICommandHandler<KnowledgeBaseBulkDeleteCommand> {
	constructor(private readonly helpCenterService: HelpCenterService) {}

	public async execute(
		command: KnowledgeBaseBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const categories = await this.helpCenterService.getCategoriesByBaseId(
			id
		);
		await this.helpCenterService.deleteBulkByBaseId(
			categories.map((item) => item.id)
		);

		return;
	}
}
