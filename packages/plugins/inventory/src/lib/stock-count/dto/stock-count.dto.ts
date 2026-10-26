/**
 * StockCount request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, IsInt, Min } from 'class-validator';
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

/**
 * The read shape: the filters a caller may narrow by, plus the page and the soft-delete visibility.
 *
 * The platform's pagination members live on `BaseQueryDTO`'s chain, which the tenant/organization DTO this
 * class extends does not join — so without these three a `take`, a `skip` or a `withDeleted` a client sends
 * is dropped by the validation pipe before the controller sees it, and the route answers its first page of live
 * rows for ever. `skip` is the page number, as it is on every REST list route here; the GraphQL connection's
 * cursor is a row offset and answers a different question.
 */
export class StockCountQueryDTO extends StockCountDTO {
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
