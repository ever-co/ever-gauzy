/**
 * ChannelWarehouse request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsUUID } from 'class-validator';
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
