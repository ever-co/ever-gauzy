import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';

/** One zone's place in the walking order. */
export class WarehouseZoneOrderItemDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly id: ID;

	@ApiProperty({ type: () => Number, description: 'The visiting position, lower first.', minimum: 0 })
	@IsNotEmpty()
	readonly priority: number;
}

/**
 * A whole new walking order for the zones of one location.
 *
 * The sequence is stated in full rather than as a single move, because the order is what the pick path
 * reads and a partial reorder can leave two zones claiming the same position.
 */
export class ReorderWarehouseZonesDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiProperty({ type: () => [WarehouseZoneOrderItemDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => WarehouseZoneOrderItemDTO)
	readonly zones: WarehouseZoneOrderItemDTO[];
}
