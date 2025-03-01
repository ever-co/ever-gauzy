import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { IDealCreateInput } from '@gauzy/contracts';
import { Deal } from '../../core/entities/internal';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Base deal DTO
 */
export class DealDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(Deal, [
		'title',
		'probability',
		'client',
		'clientId',
		'stageId',
		'stage',
		'isActive',
		'isArchived'
	] as const)
) {}

/**
 * Create deal DTO
 */
export class CreateDealDTO extends DealDTO implements IDealCreateInput {}
