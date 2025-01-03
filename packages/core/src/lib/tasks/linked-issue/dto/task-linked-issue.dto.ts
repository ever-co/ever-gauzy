import { ITaskLinkedIssue } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskLinkedIssue } from '../task-linked-issue.entity';

export class TaskLinkedIssueDTO
	extends IntersectionType(TenantOrganizationBaseDTO, TaskLinkedIssue)
	implements ITaskLinkedIssue {}
