import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IIssueTypeFindInput } from '@gauzy/contracts';
import { IssueType } from '../issue-type.entity';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class IssueTypeQueryDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PickType(IssueType, ['projectId', 'organizationTeamId'])
	)
	implements IIssueTypeFindInput {}
