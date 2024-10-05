import { IntersectionType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { IMatchingCriterions } from '@gauzy/contracts';

export class SaveJobPresetCriterionDTO
	extends IntersectionType(TenantOrganizationBaseDTO)
	implements IMatchingCriterions {}
