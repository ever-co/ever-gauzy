import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IDashboardCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { Dashboard } from '../dashboard.entity';

/**
 * Create Dashboard validation request DTO
 */
export class CreateDashboardDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(Dashboard, ['isDefault', 'createdByUser', 'createdByUserId'] as const)
	)
	implements IDashboardCreateInput {}
