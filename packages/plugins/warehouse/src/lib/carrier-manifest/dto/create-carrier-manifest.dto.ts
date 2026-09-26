import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { CarrierManifestDTO } from './carrier-manifest.dto';

/**
 * A manifest as a caller creates it.
 *
 * The caller names the carrier, the day and the window; the members are not supplied, because
 * membership is derived from what actually shipped inside that window and has not been claimed by
 * another manifest yet. Naming them by hand is what would let one parcel appear on two manifests.
 */
export class CreateCarrierManifestDTO extends CarrierManifestDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly carrier: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly service?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly manifestDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly windowFrom?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly windowTo?: Date;
}
