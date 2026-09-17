import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { WarehouseBinType } from '../../warehouse.types';

/**
 * A bin as a caller sees it.
 *
 * `capacityUnits`, `maxWeight` and `maxVolume` are exact decimal strings, never numbers: the columns
 * behind them are exact decimals and a JSON number would lose the exactness on the way in. Each of
 * them carries a sibling `…UnitId`, because a capacity is a quantity *in a stated unit* — a bin whose
 * unit of handling is a pallet and a request expressed in pieces cannot be compared without one.
 */
export class WarehouseBinDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly zoneId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly barcode?: string;

	@ApiPropertyOptional({ type: () => String, enum: WarehouseBinType })
	@IsOptional()
	@IsEnum(WarehouseBinType)
	readonly type?: WarehouseBinType;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isPickable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isBlocked?: boolean;

	@ApiPropertyOptional({ type: () => String, description: 'Maximum units, e.g. "500.000000".' })
	@IsOptional()
	@IsNumberString()
	readonly capacityUnits?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The unit `capacityUnits` is counted in.' })
	@IsOptional()
	@IsUUID()
	readonly capacityUnitId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Weight ceiling, e.g. "1200.0000".' })
	@IsOptional()
	@IsNumberString()
	readonly maxWeight?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The mass unit `maxWeight` is expressed in.' })
	@IsOptional()
	@IsUUID()
	readonly maxWeightUnitId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Volume ceiling, e.g. "3.5000".' })
	@IsOptional()
	@IsNumberString()
	readonly maxVolume?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The volume unit `maxVolume` is expressed in.' })
	@IsOptional()
	@IsUUID()
	readonly maxVolumeUnitId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly aisle?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly rack?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly level?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly position?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly sortOrder?: number;

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
