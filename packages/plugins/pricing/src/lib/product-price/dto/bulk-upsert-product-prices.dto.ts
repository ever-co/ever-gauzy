import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PriceBulkMode } from '../../pricing.types';
import { ProductPriceBulkItemDTO } from './product-price-bulk-item.dto';

/**
 * Bulk price import request validation.
 *
 * `mode` and `atomic` are the two decisions a matrix import has to make explicitly:
 *
 * - `UPSERT` touches only the rows supplied; `REPLACE` also retires the rows of the mentioned
 *   `(variant, price list)` pairs that were not supplied, which is what a full matrix export turned
 *   back into an import needs.
 * - `atomic` refuses the whole batch when any row is invalid; without it the caller receives the
 *   per-row report and decides. Both are the caller's call because a partial import is sometimes
 *   exactly what is wanted and sometimes a data incident.
 */
export class BulkUpsertProductPricesDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => Array })
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ProductPriceBulkItemDTO)
	readonly items: ProductPriceBulkItemDTO[];

	@ApiPropertyOptional({ type: () => String, enum: PriceBulkMode, default: PriceBulkMode.UPSERT })
	@IsOptional()
	@IsEnum(PriceBulkMode)
	readonly mode?: PriceBulkMode;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly atomic?: boolean;
}
