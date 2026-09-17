/**
 * StockReservation request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { StockReservationStatus, StockReservationReferenceType } from './../../inventory.enums';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockReservation request DTO validation.
 */
export class StockReservationDTO extends TenantOrganizationBaseDTO {
	/**
	 * Variant the hold applies to.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	variantId?: string;

	/**
	 * Product of the variant, carried onto the ledger row.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	productId?: string;

	/**
	 * Location the hold applies to.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	warehouseId?: string;

	/**
	 * Held quantity; always positive.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	quantity?: number;

	/**
	 * Lifecycle state of the hold.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockReservationStatus })
	@IsOptional()
	@IsEnum(StockReservationStatus)
	status?: StockReservationStatus;

	/**
	 * Kind of document the hold belongs to.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockReservationReferenceType })
	@IsOptional()
	@IsEnum(StockReservationReferenceType)
	referenceType?: StockReservationReferenceType;

	/**
	 * Id of the owning document.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	referenceId?: string;

	/**
	 * Id of the owning line.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	lineId?: string;

	/**
	 * When the hold lapses.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	expiresAt?: Date;

	/**
	 * Whether the hold was taken against stock that does not exist yet.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isBackorder?: boolean;

	/**
	 * Promised availability date of a backordered hold.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	expectedAt?: Date;
}
