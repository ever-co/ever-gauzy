import { ICommand } from '@nestjs/cqrs';
import { ID, ITaskLinkedIssueUpdateInput } from '@gauzy/contracts';

export class TaskLinkedIssueUpdateCommand implements ICommand {
	static readonly type = '[Task Linked Issue] Update';

	constructor(public readonly id: ID, public readonly input: ITaskLinkedIssueUpdateInput) {}
}
