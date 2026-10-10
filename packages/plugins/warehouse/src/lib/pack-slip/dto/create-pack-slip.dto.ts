import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { PackSlipDTO } from './pack-slip.dto';

/**
 * A pack slip as a caller creates it.
 *
 * The slip is created from work that is already picked — the lines are attached by the service from the
 * named list, so a slip can never claim units nobody collected.
 */
export class CreatePackSlipDTO extends PackSlipDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The picked list the slip is created from.' })
	@IsOptional()
	@IsUUID()
	readonly pickListId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The shipment the package belongs to.' })
	@IsOptional()
	@IsUUID()
	readonly fulfillmentId?: ID;

	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly packageCount?: number;
}
