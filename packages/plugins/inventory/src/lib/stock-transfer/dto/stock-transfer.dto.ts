/**
 * StockTransfer request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StockTransferStatus } from './../inventory.enums';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockTransfer request DTO validation.
 */
export class StockTransferDTO extends TenantOrganizationBaseDTO {
	/**
	 * Document number, unique per organization.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
		@MaxLength(64)
	number?: string;

	/**
	 * Location the stock leaves.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	fromWarehouseId?: string;

	/**
	 * Location the stock arrives at.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	toWarehouseId?: string;

	/**
	 * Lifecycle state of the transfer.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockTransferStatus })
		@IsOptional()
		@IsEnum(StockTransferStatus)
	status?: StockTransferStatus;

	/**
	 * When the transfer was dispatched.
	 */
	@ApiPropertyOptional({ type: () => Date })
		@IsOptional()
		@IsDate()
	shippedAt?: Date;

	/**
	 * When the transfer was fully received.
	 */
	@ApiPropertyOptional({ type: () => Date })
		@IsOptional()
		@IsDate()
	receivedAt?: Date;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsString()
	note?: string;

	/**
	 * Optimistic-lock counter.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsInt()
	version?: number;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
		@IsOptional()
		@IsObject()
	metadata?: Record<string, any>;
}
