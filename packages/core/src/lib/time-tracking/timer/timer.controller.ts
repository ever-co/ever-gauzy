import { Controller, UseGuards, HttpStatus, Post, Body, Get, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ITimeLog, ITimerStatus, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { TimerService } from './timer.service';
import { StartTimerDTO, StopTimerDTO, TimerStatusQueryDTO } from './dto';
import { GetTimerStatusQuery } from './queries/get-timer-status.query';
import { StartTimerCommand, StopTimerCommand } from './commands';

@ApiTags('Timer Tracker')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller('/timesheet/timer')
export class TimerController {
	constructor(
		private readonly timerService: TimerService,
		private readonly _commandBus: CommandBus,
		private readonly _queryBus: QueryBus
	) {}

	/**
	 * GET timer today's status.
	 *
	 * Retrieves the timer status for today based on the provided query parameters.
	 *
	 * @param query - An object of type TimerStatusQueryDTO containing query parameters.
	 * @returns A promise that resolves to an ITimerStatus object representing today's timer status.
	 */
	@Get('/status')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER)
	@UseValidationPipe({ whitelist: true })
	async getTimerStatus(@Query() query: TimerStatusQueryDTO): Promise<ITimerStatus> {
		return this._queryBus.execute(new GetTimerStatusQuery(query));
	}

	/**
	 * GET timer last worked status.
	 *
	 * Retrieves the last worked timer statuses based on the provided query parameters.
	 *
	 * @param query - An object of type TimerStatusQueryDTO containing query parameters.
	 * @returns A promise that resolves to an array of ITimerStatus objects representing the last worked statuses.
	 */
	@Get('/status/worked')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER)
	@UseValidationPipe({ whitelist: true })
	async getTimerWorkedStatus(@Query() query: TimerStatusQueryDTO): Promise<ITimerStatus[]> {
		return await this.timerService.getTimerWorkedStatus(query);
	}

	/**
	 * Toggle timer.
	 *
	 * Toggles the timer state (On/Off) based on the provided data.
	 *
	 * @param entity - A StartTimerDTO object containing the necessary data to toggle the timer.
	 * @returns A promise that resolves to an ITimeLog object representing the timer log after toggling,
	 *          or null if no log is created.
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
	 * Start timer endpoint.
	 *
	 * This endpoint starts the timer by executing the StartTimerCommand.
	 *
	 * @param entity - A StartTimerDTO object containing the necessary data to start the timer.
	 * @returns A promise that resolves to an ITimeLog object representing the timer's log after it has started.
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
		return this._commandBus.execute(new StartTimerCommand(entity));
	}

	/**
	 * Stop timer endpoint.
	 *
	 * This endpoint stops the timer by executing the StopTimerCommand.
	 *
	 * @param entity - A StopTimerDTO object containing the necessary data to stop the timer.
	 * @returns A promise that resolves to an ITimeLog object representing the timer's log after it has stopped,
	 *          or null if the timer was not running.
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
		return this._commandBus.execute(new StopTimerCommand(entity));
	}
}
