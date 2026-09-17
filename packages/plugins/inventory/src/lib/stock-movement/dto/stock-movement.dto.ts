/**
 * StockMovement request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StockMovementType } from './../inventory.enums';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockMovement request DTO validation.
 */
export class StockMovementDTO extends TenantOrganizationBaseDTO {
	/**
	 * Location the change happened at.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	warehouseId?: string;

	/**
	 * Product-level row the change was applied to.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	warehouseProductId?: string;

	/**
	 * Level row the change was applied to.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	warehouseProductVariantId?: string;

	/**
	 * Variant the change applies to.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	variantId?: string;

	/**
	 * Physical bin the change happened at.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	binId?: string;

	/**
	 * What caused the change.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockMovementType })
		@IsOptional()
		@IsEnum(StockMovementType)
	type?: StockMovementType;

	/**
	 * Signed change applied to the on-hand quantity.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	quantity?: number;

	/**
	 * On-hand quantity before the change.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	quantityBefore?: number;

	/**
	 * On-hand quantity after the change.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	quantityAfter?: number;

	/**
	 * Reserved quantity before the change.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	reservedBefore?: number;

	/**
	 * Reserved quantity after the change.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	reservedAfter?: number;

	/**
	 * Kind of document that caused the change.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(64)
	referenceType?: string;

	/**
	 * Id of the document that caused the change.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	referenceId?: string;

	/**
	 * Machine-readable reason code.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(64)
	reason?: string;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
	note?: string;

	/**
	 * Business time of the change.
	 */
	@ApiPropertyOptional({ type: () => Date })
		@IsOptional()
		@IsDate()
	occurredAt?: Date;
}
