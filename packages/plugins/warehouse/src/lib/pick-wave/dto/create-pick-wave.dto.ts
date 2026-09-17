import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { PickWaveStrategy } from '../../warehouse.types';
import { PickWaveDTO } from './pick-wave.dto';

/**
 * A wave as a caller creates it.
 *
 * A wave is planned from shipments that are due to leave, so the caller names the location and the
 * shipments; the number is allocated by the service from the `PICK` series and the status always
 * starts at `DRAFT`, because a wave that went straight to the floor could not be inspected first.
 */
export class CreatePickWaveDTO extends PickWaveDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiPropertyOptional({ type: () => [String], description: 'The shipments the wave is planned from.' })
	@IsOptional()
	readonly fulfillmentIds?: ID[];

	@ApiPropertyOptional({ type: () => String, enum: PickWaveStrategy })
	@IsOptional()
	@IsEnum(PickWaveStrategy)
	readonly strategy?: PickWaveStrategy;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly priority?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly plannedAt?: Date;
}
