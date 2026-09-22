/**
 * StockTransferLine request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, IsBoolean, IsInt, Min } from 'class-validator';
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

/**
 * The read shape: the filters a caller may narrow by, plus the page and the soft-delete visibility.
 *
 * The platform's pagination members live on `BaseQueryDTO`'s chain, which the tenant/organization DTO this
 * class extends does not join — so without these three a `take`, a `skip` or a `withDeleted` a client sends
 * is dropped by the validation pipe before the controller sees it, and the route answers its first page of live
 * rows for ever. `skip` is the page number, as it is on every REST list route here; the GraphQL connection's
 * cursor is a row offset and answers a different question.
 */
export class StockTransferLineQueryDTO extends StockTransferLineDTO {
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
