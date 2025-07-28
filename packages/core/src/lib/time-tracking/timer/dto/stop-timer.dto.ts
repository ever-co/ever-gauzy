import { ITimerToggleInput } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { StartTimerDTO } from './start-timer.dto';
import { IsOptional, IsString } from 'class-validator';

export class StopTimerDTO
	extends IntersectionType(StartTimerDTO, PartialType(PickType(StartTimerDTO, ['source', 'logType'] as const)))
	implements ITimerToggleInput
{
	/**
	 * Time zone in IANA format (e.g., 'Europe/Warsaw')
	 */
	@ApiPropertyOptional({ example: 'Europe/Warsaw' })
	@IsOptional()
	@IsString()
	readonly timeZone?: string;
}
