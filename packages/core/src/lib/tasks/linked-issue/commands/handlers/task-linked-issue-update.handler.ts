import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskLinkedIssue } from '@gauzy/contracts';
import { TaskLinkedIssueUpdateCommand } from '../task-linked-issue-update.command';
import { TaskLinkedIssueService } from '../../task-linked-issue.service';

@CommandHandler(TaskLinkedIssueUpdateCommand)
export class TaskLinkedIssueUpdateHandler implements ICommandHandler<TaskLinkedIssueUpdateCommand> {
	constructor(private readonly taskLinkedIssueService: TaskLinkedIssueService) {}

	public async execute(command: TaskLinkedIssueUpdateCommand): Promise<ITaskLinkedIssue> {
		const { id, input } = command;

		return await this.taskLinkedIssueService.update(id, input);
	}
}
