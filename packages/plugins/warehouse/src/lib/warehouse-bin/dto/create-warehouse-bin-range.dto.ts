import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { WarehouseBinType } from '../../warehouse.types';

/**
 * A consecutive range of bins, created in one call.
 *
 * Growing a building is done in racks and levels, not one position at a time, so the range is the
 * unit: the codes are generated from `from` by incrementing its trailing number and zero-padding it to
 * the width it was written with, which keeps `A-01-01 … A-01-12` sorting the way a person expects.
 */
export class CreateWarehouseBinRangeDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly zoneId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	@ApiProperty({ type: () => String, maxLength: 64, description: 'The first code of the range, e.g. "A-01-01".' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly from: string;

	@ApiProperty({ type: () => Number, minimum: 1, description: 'How many consecutive codes to create.' })
	@IsNotEmpty()
	@IsInt()
	@Min(1)
	readonly count: number;

	@ApiPropertyOptional({ type: () => String, enum: WarehouseBinType })
	@IsOptional()
	@IsEnum(WarehouseBinType)
	readonly type?: WarehouseBinType;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isPickable?: boolean;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly sortOrder?: number;
}
