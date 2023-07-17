import { ITaskLinkedIssue } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { TaskLinkedIssue } from '../task-linked-issue.entity';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class CreateTaskLinkedIssueDTO
	extends IntersectionType(TenantOrganizationBaseDTO, TaskLinkedIssue)
	implements ITaskLinkedIssue {}
