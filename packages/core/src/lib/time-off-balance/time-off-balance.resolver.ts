import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, ITimeOffBalance, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { TimeOffBalance } from './time-off-balance.entity';
import { TimeOffBalanceService } from './time-off-balance.service';

/** The members `AllocateTimeOffBalanceInput` declares in the schema. */
export interface IAllocateTimeOffBalanceInput {
	organizationId: Id;
	employeeId: Id;
	policyId: Id;
	year: number;
	accrued: number;
}

/** The members `AdjustTimeOffBalanceInput` declares in the schema. */
export interface IAdjustTimeOffBalanceInput {
	organizationId: Id;
	employeeId: Id;
	policyId: Id;
	year: number;
	days: number;
}

/** The members `CarryForwardTimeOffBalanceInput` declares in the schema. */
export interface ICarryForwardTimeOffBalanceInput {
	organizationId: Id;
	policyId: Id;
	fromYear: number;
	toYear: number;
	maxCarryForwardDays?: number;
}

/**
 * The fields a balance list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimeOffBalanceFilter` and
 * `TimeOffBalanceSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the row. The one relation the delivered list read fills — the policy —
 * is deliberately not filterable: the connection protocol narrows by comparing a value, and what the
 * row carries at `policy` is an object rather than a value, so `policyId` is how a caller asks for one
 * policy's balances.
 */
const TIME_OFF_BALANCE_FILTERABLE = {
	id: 'ID',
	year: 'NUMBER',
	accrued: 'DECIMAL',
	taken: 'DECIMAL',
	carriedForward: 'DECIMAL',
	carriedOut: 'DECIMAL',
	remaining: 'DECIMAL',
	employeeId: 'ID',
	policyId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/**
 * The fields the sort enum offers.
 *
 * The five day counts are sortable because a ledger is read by them — "who has most left", "who has
 * taken most" — and `year` is sortable because it is the key the delivered read already orders by, so
 * a caller that wants the delivered order explicitly must be able to state it.
 */
const TIME_OFF_BALANCE_SORTABLE = [
	'year',
	'accrued',
	'taken',
	'carriedForward',
	'carriedOut',
	'remaining',
	'createdAt',
	'updatedAt'
] as const;

/**
 * The order the connections apply when the caller states none.
 *
 * This is not an invented order: the delivered list read orders by `year` descending, and this is that
 * order with the identifier appended, which is what makes it total — a cursor names a row by its
 * position in a total order, so two balances filed for the same year need one order between them for a
 * walk over them to be stable.
 */
const TIME_OFF_BALANCE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'year', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Leave balances over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TimeOffBalanceService` method the `/api/time-off-balance`
 * routes reach, with the same arguments those routes bind.
 *
 * **The guard chain and the class permission are the controller's.** The class carries
 * `TenantPermissionGuard` and `PermissionGuard` with the class-level edit permission — which is what the
 * controller class carries — and every field then states the permission its own route runs under, so a
 * field is never narrower or wider than the route it mirrors. The two read routes state the view
 * permission on their handlers and the four write routes state the edit one, which is the same split
 * this class and its fields reproduce.
 *
 * **Two list fields, because the read the credential performs is not a filter.** `GET /me` resolves the
 * employee from the credential rather than from the request, and the connection protocol has no member
 * that can state "the caller's own employee" — a filter narrows the rows a read returned, and this read
 * is a different read. So the caller's own balances are a root field of their own, and they answer
 * through the delivered `findMine`, which is the method that route calls.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('TimeOffBalance')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
export class TimeOffBalanceResolver {
	constructor(private readonly timeOffBalanceService: TimeOffBalanceService) {}

	/**
	 * The leave balances the caller may see, newest year first.
	 *
	 * The read is the delivered list route's own — `findAllByFilter`, which is what `GET /` calls — and
	 * the criterion is built from this field's own arguments, because that read takes the query DTO the
	 * route binds its query string to and this surface has no query string. The three narrowing members
	 * are the DTO's own: `organizationId` is required by that DTO's validation and scopes the read, and
	 * `employeeId` and `policyId` and `year` are the three filters the delivered method applies to the
	 * store.
	 *
	 * Those three are arguments *and* filter members, and that is not a duplication. The delivered read
	 * applies them to the store and answers one page of its own — fifty rows, the DTO's default — so an
	 * argument decides **which** rows are read, while a filter narrows the rows that were read. A caller
	 * that wants one year out of a ledger longer than the read's own page must state it as an argument;
	 * a caller that already holds the rows narrows them with the filter.
	 *
	 * The DTO's page is deliberately not an argument. This surface pages by the connection protocol —
	 * `page`, or `limit`/`offset`, and never both — and a second, conflicting page stated in the same
	 * request is exactly what that protocol refuses.
	 */
	@Query('timeOffBalances')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	async timeOffBalances(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id,
		@Args('policyId', { type: () => ID, nullable: true }) policyId?: Id,
		@Args('year', { type: () => Int, nullable: true }) year?: number,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TimeOffBalance>> {
		const { items }: IPagination<ITimeOffBalance> = await this.timeOffBalanceService.findAllByFilter({
			organizationId,
			employeeId,
			policyId,
			year
		});

		return buildConnection<TimeOffBalance>({
			rows: (items ?? []) as TimeOffBalance[],
			filterable: TIME_OFF_BALANCE_FILTERABLE,
			sortable: TIME_OFF_BALANCE_SORTABLE,
			defaultSort: TIME_OFF_BALANCE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The caller's own leave balances, newest year first.
	 *
	 * The delivered `GET /me` route is the read this mirrors, and its whole point is that the employee is
	 * read from the credential: `findMine` takes the identifier from the request context and refuses a
	 * caller that has no engagement of its own at all. That refusal is the method's own and is not
	 * restated here — a second copy of it would be the one that drifts — so the field simply hands over
	 * the policy and the year and lets the delivered read decide whose balances they are.
	 *
	 * The delivered method answers through the same `findAllByFilter` the list above reaches, with the
	 * employee identifier added to the criterion rather than offered as one, which is why this field
	 * takes no `employeeId`.
	 */
	@Query('myTimeOffBalances')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	async myTimeOffBalances(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('policyId', { type: () => ID, nullable: true }) policyId?: Id,
		@Args('year', { type: () => Int, nullable: true }) year?: number,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TimeOffBalance>> {
		const { items }: IPagination<ITimeOffBalance> = await this.timeOffBalanceService.findMine({
			organizationId,
			policyId,
			year
		});

		return buildConnection<TimeOffBalance>({
			rows: (items ?? []) as TimeOffBalance[],
			filterable: TIME_OFF_BALANCE_FILTERABLE,
			sortable: TIME_OFF_BALANCE_SORTABLE,
			defaultSort: TIME_OFF_BALANCE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Sets the accrued days of one employee's balance under one policy for one year.
	 *
	 * The same service method the `POST /allocate` route calls, with the same input: the delivered write
	 * *replaces* `accrued` rather than adding to it, so re-running an allocation for a period is
	 * idempotent, and it creates the row when this is the first allocation. The answer is the row as it
	 * now stands, with `remaining` recomputed by the delivered write's own arithmetic and not here.
	 */
	@Mutation('allocateTimeOffBalance')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async allocateTimeOffBalance(
		@Args('input') input: IAllocateTimeOffBalanceInput
	): Promise<TimeOffBalance> {
		return await this.timeOffBalanceService.allocate(input);
	}

	/**
	 * Spends days from one balance, which is what an approved request does.
	 *
	 * The same service method the `POST /deduct` route calls. The delivered write performs the
	 * subtraction and the balance check as one conditional statement, so two approvals landing together
	 * cannot each read the same `taken` and lose one of the two deductions; a request for more days than
	 * are left is refused by that statement rather than by a check made here.
	 */
	@Mutation('deductTimeOffBalance')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async deductTimeOffBalance(@Args('input') input: IAdjustTimeOffBalanceInput): Promise<TimeOffBalance> {
		return await this.timeOffBalanceService.deduct(input);
	}

	/**
	 * Gives days back to one balance, which is what cancelling an approved request does.
	 *
	 * The same service method the `POST /reverse` route calls, with the same input. The delivered write
	 * clamps at zero, so a reversal applied twice can never push `taken` below zero and hand out leave
	 * that was never taken.
	 */
	@Mutation('reverseTimeOffBalance')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async reverseTimeOffBalance(@Args('input') input: IAdjustTimeOffBalanceInput): Promise<TimeOffBalance> {
		return await this.timeOffBalanceService.reverse(input);
	}

	/**
	 * Rolls unused days of one policy from one year into the next.
	 *
	 * The same service method the `POST /carry-forward` route calls — the service's `carryForward`, whose
	 * answer is the count below rather than a row — and the operation is a computation over every
	 * employee's balance for the policy: the days are moved rather than copied, each source year records
	 * what left it and each target year records what arrived, so the same day is never available in two
	 * years at once. It is safe to re-run because both sides are *set* to the computed value.
	 *
	 * **The answer is a count, not a row.** The delivered write answers how many employee balances it
	 * rolled over — the size of the set it walked — and there is no single balance it would be honest to
	 * answer instead, because it writes two rows per employee. The field therefore states the count, and
	 * a caller that wants the resulting rows reads them from the connection above.
	 */
	@Mutation('carryForwardTimeOffBalances')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async carryForwardTimeOffBalances(
		@Args('input') input: ICarryForwardTimeOffBalanceInput
	): Promise<{ carried: number }> {
		return await this.timeOffBalanceService.carryForward(input);
	}
}
