import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsUUID } from 'class-validator';

/**
 * A line appended to a shipment that has not left yet (`POST /fulfillments/:id/lines`, review R2-G40).
 *
 * The shipment is the path's, so the body names only what the line ships: the order line, the quantity, the
 * location the units come from and the free payload a picker writes. Tenancy is the shipment's.
 */
export class AddFulfillmentLineDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderLineId: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
