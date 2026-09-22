/**
 * StockCountLine request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, IsBoolean, IsInt, Min } from 'class-validator';
import { StockCountLineStatus } from './../../inventory.enums';
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

/**
 * The read shape: the filters a caller may narrow by, plus the page and the soft-delete visibility.
 *
 * The platform's pagination members live on `BaseQueryDTO`'s chain, which the tenant/organization DTO this
 * class extends does not join — so without these three a `take`, a `skip` or a `withDeleted` a client sends
 * is dropped by the validation pipe before the controller sees it, and the route answers its first page of live
 * rows for ever. `skip` is the page number, as it is on every REST list route here; the GraphQL connection's
 * cursor is a row offset and answers a different question.
 */
export class StockCountLineQueryDTO extends StockCountLineDTO {
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

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether retired rows are included.' })
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	withDeleted?: boolean;
}
