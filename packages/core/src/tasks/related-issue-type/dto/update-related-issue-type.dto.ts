import { ITaskRelatedIssueTypeUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskRelatedIssueTypes } from '../related-issue-type.entity';

export class UpdatesRelatedIssueTypeDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PartialType(TaskRelatedIssueTypes)
	)
	implements ITaskRelatedIssueTypeUpdateInput {}
