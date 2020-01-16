import { AggregatedEmployeeStatistic, EmployeeStatistics } from '@gauzy/models';
import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { AggregatedEmployeeStatisticQuery } from './queries/aggregate-employee-statistic.query';

@Controller()
export class EmployeeStatisticsController {
	constructor(
		private employeeStatisticsService: EmployeeStatisticsService,
		private readonly queryBus: QueryBus
	) {}

	@ApiOperation({
		summary: 'Find aggregate for all employees by organization id'
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Found records' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@Get('/aggregate')
	async findAggregatedByOrganizationId(
		@Query('data') data?: string
	): Promise<AggregatedEmployeeStatistic[]> {
		const { findInput } = JSON.parse(data);
		return this.queryBus.execute(
			new AggregatedEmployeeStatisticQuery(findInput)
		);
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/months/:id')
	async findAllByEmloyeeId(
		@Param('id') id: string,
		@Query('data') data?: string
	): Promise<EmployeeStatistics> {
		const { findInput } = JSON.parse(data);
		return this.employeeStatisticsService.getStatisticsByEmployeeId(
			id,
			findInput
		);
	}
}
