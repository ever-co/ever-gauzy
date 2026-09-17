/**
 * StockCountLine request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StockCountLineStatus } from './../inventory.enums';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockCountLine request DTO validation.
 */
export class StockCountLineDTO extends TenantOrganizationBaseDTO {
	/**
	 * Session the line belongs to.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	stockCountId?: string;

	/**
	 * Variant being counted.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	variantId?: string;

	/**
	 * Level row the line snapshots.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	warehouseProductVariantId?: string;

	/**
	 * Bin counted, when the line is bin-scoped.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	binId?: string;

	/**
	 * The address as printed on the sheet.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(255)
	binPathSnapshot?: string;

	/**
	 * Expectation snapshotted when the line was generated.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	expectedQuantity?: number;

	/**
	 * First reading.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	countedQuantity?: number;

	/**
	 * Second reading, when the line was recounted.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	recountedQuantity?: number;

	/**
	 * Derived difference between the reading that closes the line and the expectation.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	variance?: number;

	/**
	 * Outcome recorded against the line.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockCountLineStatus })
		@IsOptional()
		@IsEnum(StockCountLineStatus)
	status?: StockCountLineStatus;

	/**
	 * Free text from the counter.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
	note?: string;
}
