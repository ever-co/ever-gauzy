import { Controller, UseGuards, HttpStatus, Get, Query, ValidationPipe, UsePipes } from '@nestjs/common';
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
import { TimeTrackingStatisticQueryDTO } from './dto';
import { StatisticService } from './statistic.service';

@ApiTags('TimesheetStatistic')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(
	PermissionsEnum.ADMIN_DASHBOARD_VIEW,
	PermissionsEnum.TIME_TRACKER
)
@Controller()
export class StatisticController {

	constructor(
		private readonly statisticService: StatisticService
	) {}

	@ApiOperation({ summary: 'Statistics - counts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - counts'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('counts')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getCountsStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<ICountsStatistics> {
		return await this.statisticService.getCounts(request);
	}

	@ApiOperation({ summary: 'Statistics - members' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - members'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/members')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getMembersStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<IMembersStatistics[]> {
		return await this.statisticService.getMembers(request);
	}

	@ApiOperation({ summary: 'Statistics - projects' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - projects'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/projects')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getProjectsStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<IProjectsStatistics[]> {
		return await this.statisticService.getProjects(request);
	}

	@ApiOperation({ summary: 'Statistics - tasks' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - tasks'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/tasks')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getTasksStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<ITask[]> {
		return await this.statisticService.getTasks(request);
	}

	@ApiOperation({ summary: 'Statistics - Manual Times' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - Manual Times'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/manual-times')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getManualTimesStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<IManualTimesStatistics[]> {
		return await this.statisticService.manualTimes(request);
	}

	@ApiOperation({ summary: 'Statistics - employee time-slots' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - employee time-slots'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/time-slots')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getEmployeeTimeSlotsStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<ITimeSlotStatistics[]> {
		return await this.statisticService.getEmployeeTimeSlots(request);
	}

	@ApiOperation({ summary: 'Statistics - activities' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics - activities'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/activities')
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async getActivitiesStatistics(
		@Query() request: TimeTrackingStatisticQueryDTO
	): Promise<IActivitiesStatistics[]> {
		return await this.statisticService.getActivities(request);
	}
}
