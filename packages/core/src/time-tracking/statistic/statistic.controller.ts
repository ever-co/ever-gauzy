import { Controller, UseGuards, HttpStatus, Get, Query, ValidationPipe, UseInterceptors } from '@nestjs/common';
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
import { TransformInterceptor } from './../../core/interceptors';
import { StatisticService } from './statistic.service';

@ApiTags('TimesheetStatistic')
@UseGuards(TenantPermissionGuard)
@UseInterceptors(TransformInterceptor)
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
	async getCountsStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
	): Promise<ICountsStatistics> {
		console.log({ request });
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
	async getMembersStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
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
	async getProjectsStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
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
	async getTasksStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
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
	async getManualTimesStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
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
	async getEmployeeTimeSlotsStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
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
	async getActivitiesStatistics(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) request: StatisticCountsQueryDTO
	): Promise<IActivitiesStatistics[]> {
		return await this.statisticService.getActivities(request);
	}
}
