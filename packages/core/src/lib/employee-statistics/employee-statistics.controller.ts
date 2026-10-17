import {
	IAggregatedEmployeeStatistic,
	IEmployeeStatistics,
	IMonthAggregatedEmployeeStatistics,
	IEmployeeStatisticsHistory,
	ID
} from '@gauzy/contracts';
import { BadRequestException, Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { EmployeeService } from './../employee/employee.service';
import { TypeOrmEmployeeRepository } from './../employee/repository/type-orm-employee.repository';
import {
	assertCurrentUserBelongsToOrganization,
	assertCurrentUserBelongsToSentOrganization,
	isSent
} from './../user-organization/assert-organization-membership';
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
		const { manager } = this.typeOrmEmployeeRepository;
		await assertCurrentUserBelongsToSentOrganization(manager, findInput?.organizationId);

		// Without an organization the income and expense reads drop that filter and reach the employee in
		// whichever organization it belongs to, so that organization is the one checked. An employee is then
		// required: without one the split expense reads look up the tenant's first employee instead
		if (!isSent(findInput?.organizationId)) {
			if (!isUUID(findInput?.employeeId)) {
				throw new BadRequestException('employeeId must be a UUID');
			}
			const employee = await this.employeeService.findOneByIdString(findInput.employeeId);
			await assertCurrentUserBelongsToOrganization(manager, employee.organizationId);
		}
		return this.queryBus.execute(new EmployeeStatisticsHistoryQuery(findInput));
	}
}
