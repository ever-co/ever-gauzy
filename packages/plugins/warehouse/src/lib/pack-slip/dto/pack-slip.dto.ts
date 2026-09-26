import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PackSlipStatus } from '../../warehouse.types';

/**
 * A pack slip as a caller sees it.
 *
 * The weight and the volume are exact decimal strings. The weight is the weight of record: it is what
 * carrier rating reads and it is never recomputed from the catalogue after the fact, because a
 * re-weigh is a new packing event rather than an edit of a document a carrier already has.
 */
export class PackSlipDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly pickListId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly fulfillmentId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: PackSlipStatus })
	@IsOptional()
	@IsEnum(PackSlipStatus)
	readonly status?: PackSlipStatus;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly carrierKey?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly packageCount?: number;

	@ApiPropertyOptional({ type: () => String, description: 'Packed items plus packaging, e.g. "2.4500".' })
	@IsOptional()
	@IsString()
	readonly totalWeight?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Total volume, e.g. "0.1200".' })
	@IsOptional()
	@IsString()
	readonly totalVolume?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly trackingNumber?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 1024 })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	readonly labelUrl?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly packedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly packedByUserId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly version?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
