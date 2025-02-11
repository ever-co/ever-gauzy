import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IReactionCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Reaction } from '../reaction.entity';

/**
 * Create Reaction data validation request DTO
 */
export class CreateReactionDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(Reaction, ['createdById']))
	implements IReactionCreateInput {}
