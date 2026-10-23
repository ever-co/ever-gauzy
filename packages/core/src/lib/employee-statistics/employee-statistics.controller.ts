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
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import {
	AggregatedEmployeeStatisticQuery,
	EmployeeStatisticsHistoryQuery,
	MonthAggregatedEmployeeStatisticsQuery
} from './queries';
import { EmployeeAggregatedStatisticByMonthQueryDTO } from './dto';
import { Permissions } from './../shared/decorators';
import {
	EMPLOYEE_STATISTICS_AGGREGATE_PERMISSIONS,
	EMPLOYEE_STATISTICS_EMPLOYEE_PERMISSIONS
} from './employee-statistics.permissions';

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
	 * The organization's aggregate: every employee's income, expenses, bonus and profit over a range.
	 *
	 * Read under the Accounting dashboard tab's pair (`ADMIN_DASHBOARD_VIEW` or `ACCOUNTING_DASHBOARD`), the page
	 * and widgets that show it (see `employee-statistics.permissions.ts`).
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
	@UseGuards(PermissionGuard)
	@Permissions(...EMPLOYEE_STATISTICS_AGGREGATE_PERMISSIONS)
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
	 * One employee's twelve-month series.
	 *
	 * Read under the Human Resources dashboard tab's pair (`ADMIN_DASHBOARD_VIEW` or `HUMAN_RESOURCE_DASHBOARD`),
	 * like the employee's other figures (see `employee-statistics.permissions.ts`).
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
	@UseGuards(PermissionGuard)
	@Permissions(...EMPLOYEE_STATISTICS_EMPLOYEE_PERMISSIONS)
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
	 * One employee's statistics, one row per month of a range.
	 *
	 * Read under the Human Resources dashboard tab's pair (`ADMIN_DASHBOARD_VIEW` or `HUMAN_RESOURCE_DASHBOARD`),
	 * the page and widgets that show it (see `employee-statistics.permissions.ts`).
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
	@UseGuards(PermissionGuard)
	@Permissions(...EMPLOYEE_STATISTICS_EMPLOYEE_PERMISSIONS)
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
	 * The income and expense lines behind one employee's totals.
	 *
	 * Read under the Human Resources dashboard tab's pair (`ADMIN_DASHBOARD_VIEW` or `HUMAN_RESOURCE_DASHBOARD`),
	 * the page dialogs and widgets that show them (see `employee-statistics.permissions.ts`).
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
	@UseGuards(PermissionGuard)
	@Permissions(...EMPLOYEE_STATISTICS_EMPLOYEE_PERMISSIONS)
	@Get('/history')
	async findEmployeeStatisticsHistory(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IEmployeeStatisticsHistory[]> {
		const { findInput } = data;

		await assertStatisticsReadInScope(this.typeOrmEmployeeRepository.manager, this.employeeService, findInput);

		return this.queryBus.execute(new EmployeeStatisticsHistoryQuery(findInput));
	}
}
