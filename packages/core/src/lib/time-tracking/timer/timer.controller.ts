import { Controller, UseGuards, HttpCode, HttpStatus, Post, Body, Get, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ITimeLog, ITimerStatus, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { TimerService } from './timer.service';
import { DiscardTimerDTO, StartTimerDTO, StopTimerDTO, TimerStatusQueryDTO, ToggleTimerDTO } from './dto';
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
	 * @param entity - A ToggleTimerDTO object containing the necessary data to toggle the timer.
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
	@ApiResponse({
		status: HttpStatus.NOT_ACCEPTABLE,
		description:
			'The toggle names a time log (timeLogId) while no timer runs, or stops the running timer at a time (stoppedAt) before it started. Nothing is changed.'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The toggle names a time log (timeLogId) that is not the running one. Nothing is changed: the running timer goes on.'
	})
	@Post('/toggle')
	@UseValidationPipe()
	async toggleTimer(@Body() entity: ToggleTimerDTO): Promise<ITimeLog | null> {
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
	@ApiResponse({
		status: HttpStatus.NOT_ACCEPTABLE,
		description:
			'No timer is running, or the stop asks for a time (stoppedAt) before the running timer started. Nothing is changed.'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The stop names a time log (timeLogId) that is not the running one. Nothing is changed: the running timer goes on.'
	})
	@Post('/stop')
	@UseValidationPipe()
	async stopTimer(@Body() entity: StopTimerDTO): Promise<ITimeLog | null> {
		return this._commandBus.execute(new StopTimerCommand(entity));
	}

	/**
	 * Discard timer endpoint.
	 *
	 * Removes the caller's running timer, with its time slots, screenshots and activity, as if it never started. The
	 * time was never kept, so the timer's own permission is enough: deleting time is not asked.
	 *
	 * @param entity - A DiscardTimerDTO object, naming the running time log the discard is for when the client knows it.
	 */
	@ApiOperation({ summary: 'Discard the running timer' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: "The caller's running timer was discarded: the run, its time slots and screenshots are removed."
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'No timer is running, or the input is invalid. Nothing is removed.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description:
			'The organization turned discarding off (code TIMER_DISCARD_DISABLED), or the run started longer ago than the organization allows (code TIMER_DISCARD_TOO_LATE). Nothing is removed.'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The discard names a time log (timeLogId) that is not the running one. Nothing is removed: the running timer goes on.'
	})
	@Post('/discard')
	@HttpCode(HttpStatus.NO_CONTENT)
	@UseValidationPipe({ whitelist: true })
	async discardTimer(@Body() entity: DiscardTimerDTO): Promise<void> {
		await this.timerService.discardTimer(entity);
	}
}
