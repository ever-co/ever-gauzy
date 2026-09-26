import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { PickListLineDTO } from './pick-list-line.dto';

/**
 * A pick line as a caller adds it.
 *
 * Lines are normally derived from a shipment, and this surface exists for the two cases that are not
 * derivation: a replenishment list that serves no order, and a corrected line that has to name the bin
 * an operator decided on.
 */
export class CreatePickListLineDTO extends PickListLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly pickListId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'What the list asks for, e.g. "5.000000".' })
	@IsNotEmpty()
	@IsString()
	readonly quantityRequested: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly position?: number;
}
