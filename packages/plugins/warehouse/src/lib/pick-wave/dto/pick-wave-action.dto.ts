import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * The body of a wave transition.
 *
 * One shape covers release, start, close and cancel, because each of them records at most an operator
 * note and the transition itself is what the route names. The status is never taken from the body: a
 * caller that could set it could skip the checks each transition performs.
 */
export class PickWaveActionDTO {
	@ApiPropertyOptional({ type: () => String, description: 'The picker the wave is released to.' })
	@IsOptional()
	@IsUUID()
	readonly pickerUserId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Why the wave was closed short or cancelled.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}
