import { ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StartTimerDTO } from './start-timer.dto';

export class StopTimerDTO extends StartTimerDTO implements ITimerToggleInput {
	@ApiProperty({
		type: () => String,
		enum: TimeLogSourceEnum,
		required: true,
	})
	@IsEnum(TimeLogSourceEnum)
	readonly source: TimeLogSourceEnum;
}
