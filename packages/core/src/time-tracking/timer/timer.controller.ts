import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ITimeLog,
	ITimerStatus,
	PermissionsEnum
} from '@gauzy/contracts';
import { TimerService } from './timer.service';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { StartTimerDTO, StopTimerDTO, TimerStatusQueryDTO } from './dto';

@ApiTags('Timer Tracker')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class TimerController {

	constructor(
		private readonly timerService: TimerService
	) {}

	/**
	 * GET timer today's status
	 *
	 * @param query
	 * @returns
	 */
	@Get('/status')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getTimerStatus(
		@Query() query: TimerStatusQueryDTO
	): Promise<ITimerStatus> {
		return await this.timerService.getTimerStatus(query);
	}

	/**
	 * GET timer last worked status
	 *
	 * @param query
	 * @returns
	 */
	@Get('/status/worked')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getTimerWorkedStatus(
		@Query() query: TimerStatusQueryDTO
	): Promise<ITimerStatus> {
		return await this.timerService.getTimerWorkedStatus(query);
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
	@UsePipes(new ValidationPipe())
	async toggleTimer(
		@Body() entity: StartTimerDTO
	): Promise<ITimeLog | null> {
		return await this.timerService.toggleTimeLog(entity);
	}

	@ApiOperation({ summary: 'Start timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/start')
	@UsePipes(new ValidationPipe())
	async startTimer(
		@Body() entity: StartTimerDTO
	): Promise<ITimeLog> {
		console.log('----------------------------------Start Timer----------------------------------', entity);
		return await this.timerService.startTimer(entity);
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
	@UsePipes(new ValidationPipe())
	async stopTimer(
		@Body() entity: StopTimerDTO
	): Promise<ITimeLog | null> {
		console.log('----------------------------------Stop Timer----------------------------------', entity);
		return await this.timerService.stopTimer(entity);
	}
}
