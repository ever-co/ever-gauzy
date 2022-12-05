import { Controller, UseGuards, HttpStatus, Get, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ICountsStatistics,
	IMembersStatistics,
	IProjectsStatistics,
	ITask,
	IActivitiesStatistics,
	ITimeSlotStatistics,
	IManualTimesStatistics
} from '@gauzy/contracts';
import { TenantPermissionGuard } from './../../shared/guards';
import { StatisticCountsQueryDTO } from './dto';
import { StatisticService } from './statistic.service';

@ApiTags('TimesheetStatistic')
@UseGuards(TenantPermissionGuard)
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/counts')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getCountsStatistics(
		@Query() request: StatisticCountsQueryDTO
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getMembersStatistics(
		@Query() request: StatisticCountsQueryDTO
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getProjectsStatistics(
		@Query() request: StatisticCountsQueryDTO
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getTasksStatistics(
		@Query() request: StatisticCountsQueryDTO
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getManualTimesStatistics(
		@Query() request: StatisticCountsQueryDTO
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getEmployeeTimeSlotsStatistics(
		@Query() request: StatisticCountsQueryDTO
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async getActivitiesStatistics(
		@Query() request: StatisticCountsQueryDTO
	): Promise<IActivitiesStatistics[]> {
		return await this.statisticService.getActivities(request);
	}
}
