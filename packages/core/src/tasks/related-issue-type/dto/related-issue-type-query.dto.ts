import { ITaskRelatedIssueTypeFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskRelatedIssueTypes } from '../related-issue-type.entity';

export class RelatedIssueTypeQueryDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PickType(TaskRelatedIssueTypes, ['projectId', 'organizationTeamId'])
	)
	implements ITaskRelatedIssueTypeFindInput {}
