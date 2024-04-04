import {
	IAggregatedEmployeeStatistic,
	IEmployeeStatistics,
	IMonthAggregatedEmployeeStatistics,
	IEmployeeStatisticsHistory
} from '@gauzy/contracts';
import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import {
	AggregatedEmployeeStatisticQuery,
	EmployeeStatisticsHistoryQuery,
	MonthAggregatedEmployeeStatisticsQuery
} from './queries';
import { EmployeeAggregatedStatisticByMonthQueryDTO } from './dto';

@ApiTags('EmployeeStatistics')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmployeeStatisticsController {
	constructor(
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly queryBus: QueryBus
	) { }

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
		@Query('data', ParseJsonPipe) data: any
	): Promise<IAggregatedEmployeeStatistic[]> {
		const { findInput } = data;
		return this.queryBus.execute(new AggregatedEmployeeStatisticQuery(findInput));
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/months/:id')
	async findAllByEmloyeeId(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IEmployeeStatistics> {
		const { findInput } = data;
		return this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
	}

	@ApiOperation({
		summary: 'Find Aggregated Statistics by Employee id, valueDate and past N months'
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/months')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAggregatedStatisticsByEmployeeId(
		@Query() options: EmployeeAggregatedStatisticByMonthQueryDTO
	): Promise<IMonthAggregatedEmployeeStatistics> {
		return await this.queryBus.execute(new MonthAggregatedEmployeeStatisticsQuery(options));
	}
	@ApiOperation({
		summary: 'Find Statistics History by Employee id, valueDate and past N months'
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/history')
	async findEmployeeStatisticsHistory(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IEmployeeStatisticsHistory[]> {
		const { findInput } = data;
		return this.queryBus.execute(new EmployeeStatisticsHistoryQuery(findInput));
	}
}
