import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of a fulfilment line.
 *
 * `quantity` is positive and is validated against what the order line has left, not against what was
 * ordered: a second partial shipment of the same line is a second fulfilment, and the order line's own
 * counters are what say how much is still outstanding.
 */
export class FulfillmentLineDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly fulfillmentId: string;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderLineId: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
