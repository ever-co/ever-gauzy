import { IIssueTypeFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IssueType } from '../issue-type.entity';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class IssueTypeQuerDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PickType(IssueType, ['projectId', 'organizationTeamId'])
	)
	implements IIssueTypeFindInput {}
