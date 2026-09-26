import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PickWaveStatus, PickWaveStrategy } from '../../warehouse.types';

/**
 * A wave as a caller sees it.
 *
 * `orderCount` and `lineCount` are caches of what the wave's lists cover; they are readable here and
 * re-derived by the service rather than supplied, because a counter nobody recomputes is a counter
 * that lies.
 */
export class PickWaveDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: PickWaveStrategy })
	@IsOptional()
	@IsEnum(PickWaveStrategy)
	readonly strategy?: PickWaveStrategy;

	@ApiPropertyOptional({ type: () => String, enum: PickWaveStatus })
	@IsOptional()
	@IsEnum(PickWaveStatus)
	readonly status?: PickWaveStatus;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly priority?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly pickerUserId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly plannedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly releasedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly completedAt?: Date;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly orderCount?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly lineCount?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly version?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
