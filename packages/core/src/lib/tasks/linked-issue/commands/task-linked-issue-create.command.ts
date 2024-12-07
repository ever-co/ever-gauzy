import { ICommand } from '@nestjs/cqrs';
import { ITaskLinkedIssueCreateInput } from '@gauzy/contracts';

export class TaskLinkedIssueCreateCommand implements ICommand {
	static readonly type = '[Task Linked Issue] Create';

	constructor(public readonly input: ITaskLinkedIssueCreateInput) {}
}
