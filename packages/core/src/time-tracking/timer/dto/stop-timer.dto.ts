import { ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StartTimerDTO } from './start-timer.dto';

export class StopTimerDTO extends StartTimerDTO implements ITimerToggleInput {
	@ApiProperty({
		type: () => String,
<<<<<<< HEAD
		enum: TimeLogSourceEnum,
		required: true,
=======
		enum: TimeLogSourceEnum
>>>>>>> a9565bd517c87025c8c6bec85d26d699fd515e81
	})
	@IsEnum(TimeLogSourceEnum)
	readonly source: TimeLogSourceEnum;
}
