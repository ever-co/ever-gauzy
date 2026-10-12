import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { WarehouseZoneType } from '../../warehouse.types';
import { WarehouseZoneDTO } from './warehouse-zone.dto';

/**
 * A zone as a caller creates it.
 *
 * The location, the code and the name are required; everything else has a default a warehouse would
 * have chosen anyway, so a caller that only wants "a reserve area at this location" says exactly that.
 */
export class CreateWarehouseZoneDTO extends WarehouseZoneDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiPropertyOptional({ type: () => String, enum: WarehouseZoneType })
	@IsOptional()
	@IsEnum(WarehouseZoneType)
	readonly type?: WarehouseZoneType;
}
