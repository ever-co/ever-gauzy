import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IOrganizationStrategicInitiativeCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { OrganizationStrategicInitiative } from '../organization-strategic-initiative.entity';

/**
 * Create Organization Strategic Initiative data validation request DTO
 */
export class CreateOrganizationStrategicInitiativeDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(OrganizationStrategicInitiative, ['steward', 'goals', 'projects'])
	)
	implements IOrganizationStrategicInitiativeCreateInput {}
