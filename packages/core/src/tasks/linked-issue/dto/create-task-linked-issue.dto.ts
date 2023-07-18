import { ITaskLinkedIssue } from '@gauzy/contracts';
import { TaskLinkedIssueDTO } from './task-linked-issue.dto';

export class CreateTaskLinkedIssueDTO
	extends TaskLinkedIssueDTO
	implements ITaskLinkedIssue {}
