import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITaskLinkedIssue } from '@gauzy/contracts';
import { TaskLinkedIssueCreateCommand } from '../task-linked-issue-create.command';
import { TaskLinkedIssueService } from '../../task-linked-issue.service';

@CommandHandler(TaskLinkedIssueCreateCommand)
export class TaskLinkedIssueCreateHandler implements ICommandHandler<TaskLinkedIssueCreateCommand> {
	constructor(private readonly taskLinkedIssueService: TaskLinkedIssueService) {}

	public async execute(command: TaskLinkedIssueCreateCommand): Promise<ITaskLinkedIssue> {
		const { input } = command;

		return await this.taskLinkedIssueService.create(input);
	}
}
