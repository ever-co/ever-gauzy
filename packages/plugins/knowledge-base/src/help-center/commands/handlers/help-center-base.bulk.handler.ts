import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/common';
import { KnowledgeBaseBulkDeleteCommand } from '../help-center-base.bulk.command';
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
		const ids = categories.map((item) => item.id);
		if (isNotEmpty(ids)) {
			await this.helpCenterService.deleteBulkByBaseId(
				categories.map((item) => item.id)
			);
		}
		
		return;
	}
}
