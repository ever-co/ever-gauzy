import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FulfillmentDirection } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/** One line of a fulfilment, as a caller states it. */
export class FulfillmentLineInputDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderLineId: string;

	@ApiProperty({ type: () => Number })
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId: string;
}

/**
 * The writable surface of a fulfilment.
 *
 * `status` is absent: the lifecycle is the entity's own and moves through the controller's transitions,
 * never by a caller writing a state. `version` is absent for the same reason it is absent on every
 * optimistic-locked entity here — it travels in the entity tag.
 */
export class FulfillmentDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	@ApiPropertyOptional({ type: () => String, enum: FulfillmentDirection })
	@IsOptional()
	@IsEnum(FulfillmentDirection)
	readonly direction: FulfillmentDirection;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly providerId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly trackingNumber: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	readonly trackingUrl: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly carrier: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly service: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly requiresShipping: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly noNotification: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note: string;

	@ApiPropertyOptional({ type: () => [FulfillmentLineInputDTO] })
	@IsOptional()
	@IsArray()
	readonly lines: FulfillmentLineInputDTO[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

/** A transition request that carries an optional reason. */
export class FulfillmentTransitionDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly trackingNumber: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly carrier: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly service: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly noNotification: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly restock: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly version: number;
}
