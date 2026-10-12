import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { GoodsReceiptStatus } from '../../purchasing.types';

/**
 * A goods receipt as a caller sees it.
 *
 * The receipt is a record of something that happened, so its status, its number and the movement each
 * line produced are service-owned: a client reads them and never writes them.
 */
export class GoodsReceiptDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly purchaseOrderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: GoodsReceiptStatus })
	@IsOptional()
	@IsEnum(GoodsReceiptStatus)
	readonly status?: GoodsReceiptStatus;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly receivedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly receivedByUserId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly canceledAt?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly version?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

/**
 * The receipt number, as the service allocated it.
 */
export class GoodsReceiptNumberDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly number: string;
}
