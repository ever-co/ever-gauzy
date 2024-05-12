import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IDailyPlanUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { CreateDailyPlanDTO } from './create-daily-plan.dto';

/**
 * Update Daily Plan DTO validation
 */

export class UpdateDailyPlanDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PartialType(PickType(CreateDailyPlanDTO, ['date', 'workTimePlanned', 'status', 'employeeId']))
	)
	implements IDailyPlanUpdateInput {}
