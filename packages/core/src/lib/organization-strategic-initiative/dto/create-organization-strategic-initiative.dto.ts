import { ApiPropertyOptional, IntersectionType, OmitType } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ID, IOrganizationStrategicInitiativeCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { OrganizationStrategicInitiative } from '../organization-strategic-initiative.entity';

/**
 * Create Organization Strategic Initiative data validation request DTO
 */
export class CreateOrganizationStrategicInitiativeDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(OrganizationStrategicInitiative, ['steward', 'goals', 'projects', 'teams'])
	)
	implements IOrganizationStrategicInitiativeCreateInput
{
	/**
	 * The teams to link the initiative to directly. Each must be a team of the initiative's organization.
	 */
	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly teamIds?: ID[];
}
