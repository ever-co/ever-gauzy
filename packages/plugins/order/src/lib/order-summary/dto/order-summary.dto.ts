import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of an order totals summary.
 *
 * A summary row is written by the totals writer as part of the transaction that bumps the order's
 * version. It is exposed so an operator can read the history; it is not an authoring surface.
 */
export class OrderSummaryDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	@ApiProperty({ type: () => Number })
	@IsInt()
	readonly version: number;

	@ApiProperty({ type: () => Object })
	@IsObject()
	readonly totals: Record<string, unknown>;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	readonly currency: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason: string;
}
