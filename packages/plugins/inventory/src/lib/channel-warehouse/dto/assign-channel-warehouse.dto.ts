import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Assign a location to a channel request DTO validation.
 *
 * The assignment carries its own default flag rather than being a separate call, because promoting a
 * location to the channel’s default and demoting the previous one must be one atomic decision.
 */
export class AssignChannelWarehouseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	channelId: ID;

	@ApiProperty({ type: () => String })
	@IsUUID()
	warehouseId: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	priority?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	metadata?: Record<string, any>;
}
