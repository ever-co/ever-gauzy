import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ICountsStatistics,
	IMembersStatistics,
	IProjectsStatistics,
	ITask,
	IActivitiesStatistics,
	ITimeSlotStatistics,
	IManualTimesStatistics,
	PermissionsEnum
} from '@gauzy/contracts';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UseValidationPipe } from '../../shared/pipes';
import { TimeTrackingStatisticQueryDTO } from './dto';
import { StatisticService } from './statistic.service';

@ApiTags('TimesheetStatistic')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ALL_ORG_VIEW
)
@Controller()
export class StatisticController {
	constructor(private readonly statisticService: StatisticService) { }

	/**
	 * Retrieve statistics for counts based on the provided query parameters.
	 * @summary Get statistics for counts.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching count statistics.
	 * @returns {Promise<ICountsStatistics>} - Statistics for counts.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Counts',
		description: 'Endpoint to retrieve statistics for counts based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved statistics for counts.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/counts')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getCountsStatistics(@Query() request: TimeTrackingStatisticQueryDTO): Promise<ICountsStatistics> {
		return await this.statisticService.getCounts(request);
	}

	/**
	 * Retrieve statistics for members based on the provided query parameters.
	 * @summary Get statistics for members.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching member statistics.
	 * @returns {Promise<IMembersStatistics[]>} - An array of statistics for members.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Members',
		description: 'Endpoint to retrieve statistics for members based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved statistics for members.',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/members')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getMembersStatistics(@Query() request: TimeTrackingStatisticQueryDTO): Promise<IMembersStatistics[]> {
		return await this.statisticService.getMembers(request);
	}

	/**
	 * Retrieve statistics for projects based on the provided query parameters.
	 * @summary Get statistics for projects.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching project statistics.
	 * @returns {Promise<IProjectsStatistics[]>} - An array of statistics for projects.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Projects',
		description: 'Endpoint to retrieve statistics for projects based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved statistics for projects.',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/projects')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getProjectsStatistics(@Query() request: TimeTrackingStatisticQueryDTO): Promise<IProjectsStatistics[]> {
		return await this.statisticService.getProjects(request);
	}

	/**
	 * Retrieve statistics for tasks based on the provided query parameters.
	 * @summary Get statistics for tasks.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching task statistics.
	 * @returns {Promise<ITask[]>} - An array of statistics for tasks.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Tasks',
		description: 'Endpoint to retrieve statistics for tasks based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved statistics for tasks.',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/tasks')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getTasksStatistics(@Query() request: TimeTrackingStatisticQueryDTO): Promise<ITask[]> {
		return await this.statisticService.getTasks(request);
	}

	/**
	 * Retrieve statistics for manual times based on the provided query parameters.
	 * @summary Get statistics for manual times.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching manual times statistics.
	 * @returns {Promise<IManualTimesStatistics[]>} - An array of statistics for manual times.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Manual Times',
		description: 'Endpoint to retrieve statistics for manual times based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved statistics for manual times.',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/manual-times')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getManualTimesStatistics(@Query() request: TimeTrackingStatisticQueryDTO): Promise<IManualTimesStatistics[]> {
		return await this.statisticService.manualTimes(request);
	}

	/**
	 * Retrieve statistics for employee time slots based on the provided query parameters.
	 * @summary Get statistics for employee time slots.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching employee time slot statistics.
	 * @returns {Promise<ITimeSlotStatistics[]>} - An array of statistics for employee time slots.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Employee Time Slots',
		description: 'Endpoint to retrieve statistics for employee time slots based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved statistics for employee time slots.',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/time-slots')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getEmployeeTimeSlotsStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<ITimeSlotStatistics[]> {
		return await this.statisticService.getEmployeeTimeSlots(request);
	}

	/**
	 * Get statistics for activities based on the provided query parameters.
	 * @summary Retrieve statistics for activities.
	 * @param {TimeTrackingStatisticQueryDTO} request - The query parameters for fetching activity statistics.
	 * @returns {Promise<IActivitiesStatistics[]>} - An array of activity statistics.
	 */
	@ApiOperation({
		summary: 'Get Statistics for Activities',
		description: 'Endpoint to retrieve statistics for activities based on the provided query parameters.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved activity statistics.',
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Get('/activities')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getActivitiesStatistics(@Query() request: TimeTrackingStatisticQueryDTO): Promise<IActivitiesStatistics[]> {
		return await this.statisticService.getActivities(request);
	}
}
