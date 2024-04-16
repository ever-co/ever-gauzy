import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IGetJobPresetInput } from '@gauzy/contracts';
import { EmployeeFeatureDTO, TenantOrganizationBaseDTO } from '@gauzy/core';

export class JobPresetQueryDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PartialType(PickType(EmployeeFeatureDTO, ['employeeId']))
) implements IGetJobPresetInput { }
