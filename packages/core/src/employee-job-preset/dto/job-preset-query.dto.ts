import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IGetJobPresetInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { EmployeeFeatureDTO } from './../../employee/dto';

export class JobPresetQueryDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PartialType(PickType(EmployeeFeatureDTO, ['employeeId'])))
	implements IGetJobPresetInput {}
