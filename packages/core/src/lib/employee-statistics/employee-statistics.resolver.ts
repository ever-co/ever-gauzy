import { UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
	IAggregatedEmployeeStatistic,
	IAggregatedEmployeeStatisticFindInput,
	IChartEmployeeStatistic,
	ID as Id,
	IEmployeeStatistics,
	IEmployeeStatisticsFindInput,
	IEmployeeStatisticsHistory,
	IEmployeeStatisticsHistoryFindInput,
	IMonthAggregatedEmployeeStatistics,
	IMonthAggregatedEmployeeStatisticsFindInput,
	IStatisticSum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeStatisticsService } from './employee-statistics.service';
import {
	AggregatedEmployeeStatisticQuery,
	EmployeeStatisticsHistoryQuery,
	MonthAggregatedEmployeeStatisticsQuery
} from './queries';

/**
 * One employee's sum over a range, as `EmployeeStatisticByEmployee` declares it.
 *
 * The delivered answer nests the account the sum belongs to; this surface carries the identifier the
 * account is read by instead, because the read behind the aggregate selects four columns of that
 * account and nothing else. A local interface rather than the contracts one, so the shape the resolver
 * hands to the schema and the shape the schema declares are stated in one place.
 */
export interface IEmployeeStatisticByEmployee {
	employeeId?: Id;
	income: number;
	expense: number;
	bonus: number;
	profit: number;
}

/** What the aggregate field answers, as `EmployeeStatisticsAggregate` declares it. */
export interface IEmployeeStatisticsAggregate {
	total: IStatisticSum;
	employees: IEmployeeStatisticByEmployee[];
	chart: IChartEmployeeStatistic[];
}

/**
 * One history line, as `EmployeeStatisticsHistoryEntry` declares it.
 *
 * The delivered line carries the client as a row; this surface carries the identifier, for the same
 * reason and with the same comment as the aggregate's account.
 */
export interface IEmployeeStatisticsHistoryEntry extends Omit<IEmployeeStatisticsHistory, 'client'> {
	clientId?: Id;
}

/**
 * The employee statistics over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EmployeeStatisticsService` method, or dispatches the
 * same query, that the `/api/employee-statistics` routes reach.
 *
 * **The four fields are computed answers, not resources**, which is why the domain has no connection,
 * no node query and no write: a statistic has no identifier, nothing to withdraw and nothing to state.
 * The controller serves four `GET` routes and no other operation, and this surface states exactly those
 * four capabilities.
 *
 * **The guard chain is the controller's and the permission is the absence the controller states.**
 * `EmployeeStatisticsController` carries `TenantPermissionGuard` at class level and no `@Permissions`
 * anywhere — on the class or on a handler — so the class here carries that guard beside the gate and
 * every field states no permission at all. A field that demanded one would refuse a caller the REST
 * route serves, which is the narrowing this delivery exists to prevent.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmployeeStatistics')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EmployeeStatisticsResolver {
	constructor(
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * What one organization's employees earned, spent and are owed over a range.
	 *
	 * The write is dispatched as the same query the aggregate route dispatches, with the same input the
	 * route binds from its `data` parameter. The per-employee view is reshaped in one place: the
	 * delivered answer nests the account behind each sum and this surface answers the identifier it is
	 * read by, which is the only difference between the answer the route returns and the answer this
	 * field returns.
	 */
	@Query('employeeStatisticsAggregate')
	async employeeStatisticsAggregate(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date
	): Promise<IEmployeeStatisticsAggregate> {
		const answer: IAggregatedEmployeeStatistic = await this.queryBus.execute(
			new AggregatedEmployeeStatisticQuery({
				organizationId,
				startDate,
				endDate
			} as unknown as IAggregatedEmployeeStatisticFindInput)
		);

		return {
			total: answer.total,
			employees: (answer.employees ?? []).map((row) => ({
				employeeId: row.employee?.id,
				income: row.income,
				expense: row.expense,
				bonus: row.bonus,
				profit: row.profit
			})),
			// The chart is a per-day total rather than a row, so it is answered as the delivered
			// calculation produced it.
			chart: answer.chart ?? []
		};
	}

	/**
	 * One employee's twelve-month series.
	 *
	 * The same service method the per-employee route calls, with the same two arguments: the identifier
	 * the route takes from its path and the date it reads out of its `data` parameter.
	 *
	 * The date is passed as the whole options object or not at all, and never as an object with an
	 * absent member: the delivered method calls `toString()` on the date before it reads anything, so a
	 * stated-but-empty options object is a `TypeError` rather than "no date". A caller that states none
	 * gets the call the route makes when its `data` parameter carries none.
	 */
	@Query('employeeStatisticsSeries')
	async employeeStatisticsSeries(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('valueDate', { type: () => Date, nullable: true }) valueDate?: Date
	): Promise<IEmployeeStatistics> {
		return await this.employeeStatisticsService.getStatisticsByEmployeeId(
			employeeId,
			valueDate ? ({ valueDate } as IEmployeeStatisticsFindInput) : undefined
		);
	}

	/**
	 * One employee's statistics, one row per month of a range, newest first.
	 *
	 * The same query the monthly route dispatches, with the same input its validation pipe produces:
	 * the employee, the two ends of the range and the organization that narrows the incomes and the
	 * expenses. An absent end of the range is the statement the delivered handler defaults, so the field
	 * passes it through rather than substituting a date of its own.
	 */
	@Query('employeeMonthlyStatistics')
	async employeeMonthlyStatistics(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<IMonthAggregatedEmployeeStatistics[]> {
		return await this.queryBus.execute(
			new MonthAggregatedEmployeeStatisticsQuery({
				employeeId,
				startDate,
				endDate,
				organizationId
			} as unknown as IMonthAggregatedEmployeeStatisticsFindInput)
		);
	}

	/**
	 * The individual lines behind an employee's totals, selected by source.
	 *
	 * The same query the history route dispatches, with the same input, and the same answer the
	 * delivered handler produces — including the empty list it answers for a `type` it does not
	 * recognise, which is the delivered behaviour rather than a refusal invented here.
	 *
	 * Each line is reshaped in one place: the delivered line carries the client as a row and this
	 * surface carries its identifier, for the same reason the aggregate's account is carried that way.
	 */
	@Query('employeeStatisticsHistory')
	async employeeStatisticsHistory(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('type', { type: () => String }) type: string,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<IEmployeeStatisticsHistoryEntry[]> {
		const lines: IEmployeeStatisticsHistory[] = await this.queryBus.execute(
			new EmployeeStatisticsHistoryQuery({
				employeeId,
				type,
				startDate,
				endDate,
				organizationId
			} as unknown as IEmployeeStatisticsHistoryFindInput)
		);

		return (lines ?? []).map((line) => ({
			valueDate: line.valueDate,
			amount: line.amount,
			notes: line.notes,
			vendorName: line.vendorName,
			clientId: line.client?.id,
			categoryName: line.categoryName,
			isRecurring: line.isRecurring,
			isBonus: line.isBonus,
			isSalary: line.isSalary,
			source: line.source,
			splitExpense: line.splitExpense
		}));
	}
}
