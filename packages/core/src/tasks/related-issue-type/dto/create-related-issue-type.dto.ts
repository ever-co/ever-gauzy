import { ITaskRelatedIssueTypeCreateInput } from '@gauzy/contracts';
import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TaskRelatedIssueTypes } from '../related-issue-type.entity';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class CreateRelatedIssueTypeDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		TaskRelatedIssueTypes
	)
	implements ITaskRelatedIssueTypeCreateInput {}
