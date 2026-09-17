/**
 * StockCount request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StockCountStatus, StockCountMode } from './../../inventory.enums';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockCount request DTO validation.
 */
export class StockCountDTO extends TenantOrganizationBaseDTO {
	/**
	 * Session number, unique per organization.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	number?: string;

	/**
	 * Location being counted.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	warehouseId?: string;

	/**
	 * Lifecycle state of the session.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockCountStatus })
	@IsOptional()
	@IsEnum(StockCountStatus)
	status?: StockCountStatus;

	/**
	 * How the scope was generated.
	 */
	@ApiPropertyOptional({ type: () => String, enum: StockCountMode })
	@IsOptional()
	@IsEnum(StockCountMode)
	mode?: StockCountMode;

	/**
	 * Zone being counted, when the session is scoped to one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	zoneId?: string;

	/**
	 * Bin being counted, when the session is scoped to one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	binId?: string;

	/**
	 * Whether the expected quantity is withheld from the sheet.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	blindCount?: boolean;

	/**
	 * Whether quantity-changing movements in scope are refused while the session is open.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	freezeMovements?: boolean;

	/**
	 * The filter used to generate the lines.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	scope?: Record<string, any>;

	/**
	 * The extended scope criteria.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	scopeCriteria?: Record<string, any>;

	/**
	 * Free text from the operator.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	note?: string;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	metadata?: Record<string, any>;
}
