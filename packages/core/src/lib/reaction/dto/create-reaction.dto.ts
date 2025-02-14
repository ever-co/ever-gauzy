import { IntersectionType, PickType } from '@nestjs/swagger';
import { IReactionCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Reaction } from '../reaction.entity';

/**
 * Create Reaction data validation request DTO.
 *
 * This DTO combines:
 * - TenantOrganizationBaseDTO: provides tenant and organization-related properties.
 * - A selection of properties from Reaction (entity, entityId, and emoji).
 *
 * The resulting class implements IReactionCreateInput.
 */
export class CreateReactionDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(Reaction, ['entity', 'entityId', 'emoji'] as const))
	implements IReactionCreateInput {}
