import {
	IAggregatedEmployeeStatistic,
	IEmployeeStatistics,
	IMonthAggregatedEmployeeStatistics,
	IEmployeeStatisticsHistory,
	ID
} from '@gauzy/contracts';
import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeeService } from './../employee/employee.service';
import { TypeOrmEmployeeRepository } from './../employee/repository/type-orm-employee.repository';
import { assertCurrentUserBelongsToSentOrganization } from './../user-organization/assert-organization-membership';
import { assertStatisticsReadInScope } from './employee-statistics-scope';
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
@Controller('/employee-statistics')
export class EmployeeStatisticsController {
	constructor(
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly queryBus: QueryBus,
		private readonly employeeService: EmployeeService,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository
	) {}

	/**
	 *
	 * @param data
	 * @returns
	 */
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
		await assertCurrentUserBelongsToSentOrganization(
			this.typeOrmEmployeeRepository.manager,
			findInput?.organizationId
		);
		return this.queryBus.execute(new AggregatedEmployeeStatisticQuery(findInput));
	}

	/**
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/months/:id')
	async findAllByEmployeeId(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IEmployeeStatistics> {
		const { findInput } = data;

		await assertStatisticsReadInScope(this.typeOrmEmployeeRepository.manager, this.employeeService, {
			employeeId: id
		});

		return this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
	}

	/**
	 *
	 * @param options
	 * @returns
	 */
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
		// The query states no organization, so the reads reach the employee in whichever organization it is.
		await assertStatisticsReadInScope(this.typeOrmEmployeeRepository.manager, this.employeeService, options);

		return await this.queryBus.execute(new MonthAggregatedEmployeeStatisticsQuery(options));
	}

	/**
	 *
	 * @param data
	 * @returns
	 */
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

		await assertStatisticsReadInScope(this.typeOrmEmployeeRepository.manager, this.employeeService, findInput);

		return this.queryBus.execute(new EmployeeStatisticsHistoryQuery(findInput));
	}
}
