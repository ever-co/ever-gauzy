import { ITaskLinkedIssue } from '@gauzy/contracts';
import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TaskLinkedIssue } from '../task-linked-issue.entity';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class CreateTaskLinkedIssueDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		TaskLinkedIssue
	)
	implements ITaskLinkedIssue {}
