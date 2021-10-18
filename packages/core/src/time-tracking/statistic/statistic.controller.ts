import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatisticService } from './statistic.service';
import {
	IGetMembersStatistics,
	IGetProjectsStatistics,
	IGetTasksStatistics,
	IGetTimeSlotStatistics,
	IGetActivitiesStatistics,
	IGetCountsStatistics,
	IGetManualTimesStatistics,
	ICountsStatistics,
	IMembersStatistics,
	IProjectsStatistics
} from '@gauzy/contracts';
import { TenantPermissionGuard } from './../../shared/guards';

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
	async counts(
		@Query() request: IGetCountsStatistics
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
	async members(
		@Query() request: IGetMembersStatistics
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
	async projects(
		@Query() request: IGetProjectsStatistics
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
	async tasks(
		@Query() request: IGetTasksStatistics
	) {
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
	async manualTimes(
		@Query() request: IGetManualTimesStatistics
	) {
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
	async employeeTimeslots(
		@Query() request: IGetTimeSlotStatistics
	) {
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
	async activities(
		@Query() request: IGetActivitiesStatistics
	) {
		return await this.statisticService.getActivites(request);
	}
}
