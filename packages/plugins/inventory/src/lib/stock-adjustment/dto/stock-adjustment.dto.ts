/**
 * StockAdjustment request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StockAdjustmentType, StockAdjustmentStatus } from './../inventory.enums';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockAdjustment request DTO validation.
 */
export class StockAdjustmentDTO extends TenantOrganizationBaseDTO {
	/**
	 * Instruction number, unique per organization.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(32)
	number?: string;

	/**
	 * Location being corrected.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	warehouseId?: string;

	/**
	 * Variant being corrected.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	variantId?: string;

	/**
	 * How the quantity is interpreted.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockAdjustmentType })
		@IsOptional()
		@IsEnum(StockAdjustmentType)
	type?: StockAdjustmentType;

	/**
	 * Stated quantity; for a set, the observed target.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	quantity?: number;

	/**
	 * Governed reason code.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(64)
	reasonCode?: string;

	/**
	 * Free-text supplement.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(255)
	reason?: string;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
	note?: string;

	/**
	 * Lifecycle state of the instruction.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockAdjustmentStatus })
		@IsOptional()
		@IsEnum(StockAdjustmentStatus)
	status?: StockAdjustmentStatus;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
		@IsOptional()
		@IsObject()
	metadata?: Record<string, any>;
}
