import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { WarehouseBinType } from '../../warehouse.types';
import { WarehouseBinDTO } from './warehouse-bin.dto';

/**
 * A bin as a caller creates it.
 *
 * A bin may nest: naming a parent places it inside that position, and the service walks the closure
 * table to make sure the resulting tree is still a tree before it writes.
 */
export class CreateWarehouseBinDTO extends WarehouseBinDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => String, enum: WarehouseBinType })
	@IsOptional()
	@IsEnum(WarehouseBinType)
	readonly type?: WarehouseBinType;
}
