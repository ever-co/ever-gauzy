import { IntersectionType } from '@nestjs/swagger';
import { IActivity, IBulkActivitiesInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { EmployeeFeatureDTO } from '../../../employee/dto';

/**
 * Get activities request DTO validation
 */
export class BulkActivityInputDTO
	extends IntersectionType(TenantOrganizationBaseDTO, EmployeeFeatureDTO)
	implements IBulkActivitiesInput
{
	readonly activities: IActivity[];
}
