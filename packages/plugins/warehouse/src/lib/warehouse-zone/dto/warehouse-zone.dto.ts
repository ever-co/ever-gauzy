import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { WarehouseZoneType } from '../../warehouse.types';

/**
 * A zone as a caller sees it.
 *
 * `priority` and `version` are readable and only the service writes them: the visiting order is
 * rewritten wholesale when an operator reorders the zones, and the version is what a concurrent edit
 * has to agree with.
 */
export class WarehouseZoneDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => String, enum: WarehouseZoneType })
	@IsOptional()
	@IsEnum(WarehouseZoneType)
	readonly type?: WarehouseZoneType;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly priority?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isPickable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isReceivable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isShippable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isBlocked?: boolean;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Cold-chain lower bound in degrees Celsius, e.g. "2.00".'
	})
	@IsOptional()
	@IsNumberString()
	readonly minTemperature?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Cold-chain upper bound, e.g. "8.00".' })
	@IsOptional()
	@IsNumberString()
	readonly maxTemperature?: string;

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
