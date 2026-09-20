import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * One line of a goods receipt as a caller sees it.
 *
 * `stockMovementId` is the link back to the ledger row this line produced, and it is written by the
 * service in the same operation as the receipt — a client reads it and never sets it.
 */
export class GoodsReceiptLineDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly receiptId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly purchaseOrderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly quantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly damagedQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly unitCost?: DecimalString;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly batchNumber?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expiresAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseBinId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly stockMovementId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
