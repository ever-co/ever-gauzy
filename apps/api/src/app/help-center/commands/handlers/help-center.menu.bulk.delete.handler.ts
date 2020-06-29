import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { KnowledgeBaseCategoryBulkDeleteCommand } from '../help-center.menu.bulk.delete.command';
import { HelpCenterService } from '../../help-center.service';

@CommandHandler(KnowledgeBaseCategoryBulkDeleteCommand)
export class KnowledgeBaseCategoryBulkDeleteHandler
	implements ICommandHandler<KnowledgeBaseCategoryBulkDeleteCommand> {
	constructor(private readonly helpCenterService: HelpCenterService) {}

	public async execute(
		command: KnowledgeBaseCategoryBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		console.log(id);
		// const interviewers = await this.candidateInterviewersService.getInterviewersByInterviewId(
		// 	id
		// );
		// await this.candidateInterviewersService.deleteBulk(
		// 	interviewers.map((item) => item.id)
		// );

		return;
	}
}
