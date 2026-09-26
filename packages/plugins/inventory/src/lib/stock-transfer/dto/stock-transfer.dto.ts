/**
 * StockTransfer request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, IsBoolean, Min } from 'class-validator';
import { StockTransferStatus } from './../../inventory.enums';
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

/**
 * The read shape: the filters a caller may narrow by, plus the page and the soft-delete visibility.
 *
 * The platform's pagination members live on `BaseQueryDTO`'s chain, which the tenant/organization DTO this
 * class extends does not join — so without these three a `take`, a `skip` or a `withDeleted` a client sends
 * is dropped by the validation pipe before the controller sees it, and the route answers its first page of live
 * rows for ever. `skip` is the page number, as it is on every REST list route here; the GraphQL connection's
 * cursor is a row offset and answers a different question.
 */
export class StockTransferQueryDTO extends StockTransferDTO {
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

	/**
	 * Whether retired rows are included. The transform below runs only where a validation pipe does, and
	 * the list route this DTO describes mounts none, so its handler receives the raw query string and
	 * parses it itself with `isQueryFlagSet` — `'false'` is a truthy string, not a false flag.
	 */
	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether retired rows are included.' })
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	withDeleted?: boolean;
}
