import { Controller, UseGuards, HttpStatus, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ITimeLog, ITimerStatus, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { TimerService } from './timer.service';
import { StartTimerDTO, StopTimerDTO, TimerStatusQueryDTO } from './dto';

@ApiTags('Timer Tracker')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class TimerController {
	constructor(private readonly timerService: TimerService) {}

	/**
	 * GET timer today's status
	 *
	 * @param query
	 * @returns
	 */
	@Get('/status')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER)
	@UseValidationPipe({ whitelist: true })
	async getTimerStatus(@Query() query: TimerStatusQueryDTO): Promise<ITimerStatus> {
		const status = await this.timerService.getTimerStatus(query);
		this.timerService.checkForPeriodicSave(status.lastLog);
		return status;
	}

	/**
	 * GET timer last worked status
	 *
	 * @param query
	 * @returns
	 */
	@Get('/status/worked')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER)
	@UseValidationPipe({ whitelist: true })
	async getTimerWorkedStatus(@Query() query: TimerStatusQueryDTO): Promise<ITimerStatus[]> {
		return await this.timerService.getTimerWorkedStatus(query);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Toggle timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/toggle')
	@UseValidationPipe()
	async toggleTimer(@Body() entity: StartTimerDTO): Promise<ITimeLog | null> {
		return await this.timerService.toggleTimeLog(entity);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
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
	@UseValidationPipe()
	async startTimer(@Body() entity: StartTimerDTO): Promise<ITimeLog> {
		return await this.timerService.startTimer(entity);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Stop timer' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/stop')
	@UseValidationPipe()
	async stopTimer(@Body() entity: StopTimerDTO): Promise<ITimeLog | null> {
		return await this.timerService.stopTimer(entity);
	}
}
