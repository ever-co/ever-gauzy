import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { PickListDTO } from './pick-list.dto';

/**
 * A pick list as a caller creates it.
 *
 * The lines are not supplied: they are derived from the shipments named here, which is what keeps the
 * sum of the requested quantities equal to what those shipments still need. A caller that could post
 * lines could ask a picker to collect something nobody ordered.
 */
export class CreatePickListDTO extends PickListDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiPropertyOptional({ type: () => [String], description: 'The shipments the lines are derived from.' })
	@IsOptional()
	readonly fulfillmentIds?: ID[];

	@ApiPropertyOptional({ type: () => String, description: 'The wave the list is dispatched in.' })
	@IsOptional()
	@IsUUID()
	readonly waveId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Split the work by this area.' })
	@IsOptional()
	@IsUUID()
	readonly zoneId?: ID;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly priority?: number;
}
