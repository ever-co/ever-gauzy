/**
 * StockAdjustment request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { StockAdjustmentType, StockAdjustmentStatus } from './../../inventory.enums';
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

/**
 * The read shape: the filters a caller may narrow by, plus the page and the soft-delete visibility.
 *
 * The platform's pagination members live on `BaseQueryDTO`'s chain, which the tenant/organization DTO this
 * class extends does not join ? so without these three a `take`, a `skip` or a `withDeleted` a client sends
 * is dropped by the validation pipe before the controller sees it, and the route answers its first page of live
 * rows for ever. `skip` is the page number, as it is on every REST list route here; the GraphQL connection's
 * cursor is a row offset and answers a different question.
 */
export class StockAdjustmentQueryDTO extends StockAdjustmentDTO {
	@ApiPropertyOptional({ type: () => Number, description: 'Rows per page.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	take?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Page number, one-based.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	skip?: number;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether retired instructions are included.' })
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	withDeleted?: boolean;
}
