import { IntersectionType, PickType } from '@nestjs/swagger';
import { IReactionUpdateInput } from '@gauzy/contracts';
import { Reaction } from '../reaction.entity';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Update Reaction data validation request DTO
 */
export class UpdateReactionDTO
	extends IntersectionType(TenantOrganizationBaseDTO, PickType(Reaction, ['emoji']))
	implements IReactionUpdateInput {}
