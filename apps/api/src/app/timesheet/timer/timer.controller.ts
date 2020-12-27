import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
	ITimerToggleInput,
	ITimeLog,
	ITimerStatus,
	ITimerStatusInput
} from '@gauzy/models';
import { TimerService } from './timer.service';
import { TenantPermissionGuard } from '../../shared/guards/auth/tenant-permission.guard';

@ApiTags('Timer')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('timer')
export class TimerController {
	constructor(private readonly timerService: TimerService) {}

	@ApiOperation({ summary: 'Toggle timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/status')
	async getTimerStatus(
		@Query() require: ITimerStatusInput
	): Promise<ITimerStatus> {
		return this.timerService.getTimerStatus(require);
	}

	@ApiOperation({ summary: 'Toggle timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/toggle')
	async toggleTimer(@Body() entity: ITimerToggleInput): Promise<ITimeLog> {
		return this.timerService.toggleTimeLog(entity);
	}

	@ApiOperation({ summary: 'Start timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/start')
	async startTimer(@Body() entity: ITimerToggleInput): Promise<ITimeLog> {
		return this.timerService.startTimer(entity);
	}

	@ApiOperation({ summary: 'Stop timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/stop')
	async stopTimer(@Body() entity: ITimerToggleInput): Promise<ITimeLog> {
		return this.timerService.stopTimer(entity);
	}
}
