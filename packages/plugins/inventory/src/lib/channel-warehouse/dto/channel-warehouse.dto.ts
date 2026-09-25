/**
 * ChannelWarehouse request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsUUID, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * ChannelWarehouse request DTO validation.
 */
export class ChannelWarehouseDTO extends TenantOrganizationBaseDTO {
	/**
	 * Sales context the location is enabled for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	channelId?: string;

	/**
	 * Location enabled for the channel.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	warehouseId?: string;

	/**
	 * Whether the channel prefers this location.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;

	/**
	 * Allocation preference among the channel’s locations; higher wins.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	priority?: number;

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
export class ChannelWarehouseQueryDTO extends ChannelWarehouseDTO {
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
