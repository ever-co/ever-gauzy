import { PickType } from '@nestjs/swagger';
import { IReactionUpdateInput } from '@gauzy/contracts';
import { Reaction } from '../reaction.entity';

/**
 * Update Reaction data validation request DTO
 */
export class UpdateReactionDTO extends PickType(Reaction, ['emoji']) implements IReactionUpdateInput {}
