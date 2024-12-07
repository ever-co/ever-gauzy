import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { IDealCreateInput } from '@gauzy/contracts';
import { Deal } from '../../core/entities/internal';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Deal DTO
 */
export class DealDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(Deal, ['title', 'probability', 'clientId', 'stageId', 'isActive', 'isArchived'])
) {}

/**
 * Create deal DTO
 */
export class CreateDealDTO extends DealDTO implements IDealCreateInput {}
