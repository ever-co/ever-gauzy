import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StatisticService } from './statistic.service';
import {
	GetMembersStatistics,
	GetProjectsStatistics,
	GetTasksStatistics,
	GetTimeSlotStatistics,
	GetActivitiesStatistics,
	GetCountsStatistics,
	GetManualTimesStatistics
} from '@gauzy/models';

@ApiTags('Timesheet Statistic')
@UseGuards(AuthGuard('jwt'))
@Controller('statistics')
export class StatisticController {
	constructor(private readonly statisticService: StatisticService) {}

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
	@Get('/counts')
	async counts(@Query() request: GetCountsStatistics) {
		return await this.statisticService.getcounts(request);
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
	async members(@Query() request: GetMembersStatistics) {
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
	async projects(@Query() request: GetProjectsStatistics) {
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
	async tasks(@Query() request: GetTasksStatistics) {
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
	async manualTimes(@Query() request: GetManualTimesStatistics) {
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
	async employeeTimeslots(@Query() request: GetTimeSlotStatistics) {
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
	async activities(@Query() request: GetActivitiesStatistics) {
		return await this.statisticService.getActivites(request);
	}
}
