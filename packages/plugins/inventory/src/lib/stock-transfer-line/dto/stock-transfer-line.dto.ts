/**
 * StockTransferLine request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockTransferLine request DTO validation.
 */
export class StockTransferLineDTO extends TenantOrganizationBaseDTO {
	/**
	 * Transfer the line belongs to.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	transferId?: string;

	/**
	 * Variant being moved.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	variantId?: string;

	/**
	 * Quantity asked for.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	requestedQuantity?: number;

	/**
	 * Quantity dispatched.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	shippedQuantity?: number;

	/**
	 * Quantity that arrived.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	receivedQuantity?: number;

	/**
	 * Quantity that arrived unsellable.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	damagedQuantity?: number;

	/**
	 * Cost carried across the transfer for valuation.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	unitCost?: number;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
	note?: string;
}
