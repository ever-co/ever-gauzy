import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	DecimalString,
	ID as Id,
	IFindStartDateUpdateTypeInput,
	IPagination,
	IRecurringExpenseDeleteInput,
	IRecurringExpenseEditInput,
	IStartUpdateTypeInfo,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import {
	EmployeeRecurringExpenseCreateCommand,
	EmployeeRecurringExpenseDeleteCommand,
	EmployeeRecurringExpenseEditCommand
} from './commands';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import { EmployeeRecurringExpenseStartDateUpdateTypeQuery } from './queries';

/**
 * The members `CreateEmployeeRecurringExpenseInput` declares in the schema.
 *
 * The row stores the start and the end of the arrangement twice — as a date and as the day, month and
 * year the delivered date arithmetic reads — so both spellings are members, as both are members of the
 * delivered body. The employee is optional because the delivered body makes it optional: a standing
 * cost the whole organization carries is recorded with no employee at all, which is the "All
 * Employees" arrangement the delivered validation was widened to accept.
 */
export interface ICreateEmployeeRecurringExpenseInput {
	value: DecimalString;
	currency: string;
	categoryName: string;
	startDay: number;
	startMonth: number;
	startYear: number;
	startDate: Date;
	endDay?: number;
	endMonth?: number;
	endYear?: number;
	endDate?: Date;
	parentRecurringExpenseId?: Id;
	organizationId?: Id;
	employeeId?: Id;
}

/**
 * The members `UpdateEmployeeRecurringExpenseInput` declares in the schema.
 *
 * These are the members the delivered edit **reads**, and nothing else. Its body validates more — the
 * end of the arrangement, the parent, the currency — and the delivered handler writes none of them:
 * the plain edit writes the beginning and the value, and the branch that closes one arrangement and
 * opens its successor takes the currency and the parent from the row it is replacing rather than from
 * the caller. An input member the write ignores is worse than no member at all, so those are not
 * offered here.
 *
 * `startDateUpdateType` is not a member either, for a different reason: the delivered handler computes
 * it from the beginning the caller states, by asking the same question the
 * `employeeRecurringExpenseStartDateUpdateType` root field answers, and it overwrites whatever the body
 * carried. A caller that wants to know which branch its edit will take reads that field first.
 *
 * The employee is optional and is *not* merely informational: on this resource it is the assignment
 * the edit may switch, and the delivered handler reads an absent member, an explicit `null` and an
 * identifier as three different instructions.
 */
export interface IUpdateEmployeeRecurringExpenseInput {
	id: Id;
	startDay: number;
	startMonth: number;
	startYear: number;
	categoryName: string;
	value: DecimalString;
	employeeId?: Id | null;
}

/**
 * The fields a recurring-expense list may be filtered and sorted by, and the order it is returned in
 * when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeRecurringExpenseFilter` and
 * `EmployeeRecurringExpenseSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * **The month route is a narrowing of this list, and every member it narrows by is here.** That route
 * answers the arrangements in force during one month — the ones that begin inside it with no end yet,
 * and the ones that begin before it and end after it — which is the disjunction stated in
 * `employee-recurring-expense.api.gql`. Both halves of it are drawn from these columns and from the
 * `or` group, so a caller loses no question by asking it here.
 *
 * Every amount is `DECIMAL` rather than `NUMBER` because it is money: a standing cost compared as a
 * floating-point number is a cost that selects the wrong rows. The two dates are `DATE`, so a window is
 * compared as instants rather than as their spelling. `deletedAt` is absent because the delivered list
 * read answers live rows only, and the tenant is absent because it is applied to the criterion from the
 * credential rather than from the caller.
 */
const EMPLOYEE_RECURRING_EXPENSE_FILTERABLE = {
	id: 'ID',
	startDay: 'NUMBER',
	startMonth: 'NUMBER',
	startYear: 'NUMBER',
	startDate: 'DATE',
	endDay: 'NUMBER',
	endMonth: 'NUMBER',
	endYear: 'NUMBER',
	endDate: 'DATE',
	categoryName: 'STRING',
	value: 'DECIMAL',
	currency: 'STRING',
	parentRecurringExpenseId: 'ID',
	employeeId: 'ID',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_RECURRING_EXPENSE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startDate',
	'endDate',
	'value',
	'categoryName'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own, so this is a decision the connection has to
 * make rather than one it reproduces: the beginning of the arrangement, newest first, because that is
 * the column a payroll run is read by and the column the delivered month route narrows on; then the
 * identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const EMPLOYEE_RECURRING_EXPENSE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'startDate', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The standing costs one employee carries, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `EmployeeRecurringExpenseService` method, dispatches the same
 * command or executes the same query the `/api/employee-recurring-expense` route behind it does, with
 * the same payload and the same request facts.
 *
 * **The guard chain and the permission are the controller's, field by field.** The class carries what
 * the controller class carries — both guards, and the class-level edit permission — and every field
 * then states the permission its own route runs under. The two reads of the beginning of an arrangement
 * are the fields that state the view permission, because those are the routes that state it; the node
 * read, the count, the creation, the edit, the removal and the two lifecycle moves run under the
 * class-level edit permission, which is the whole of their scope — the edit and the removal are
 * declared on the controller without a permission of their own, and the rest are inherited from the
 * CRUD base, which states none.
 *
 * **The two reads are root fields of their own rather than filters on the connection.** The month route
 * is a narrowing of the list and *is* folded in: its criterion is a disjunction over the beginning and
 * the end of an arrangement, which the connection's `filter` states exactly — see the domain's
 * `employee-recurring-expense.api.gql`, which writes the disjunction out. The beginning-of-arrangement
 * read is not a narrowing at all: it answers a computed verdict about a change the caller has not made
 * yet, together with the rows that verdict was drawn from, so there is no row for a filter to narrow.
 *
 * **The organization is taken from the credential rather than stated by the caller.** Every client of
 * these routes sends the organization it is working in, and the delivered month handler cannot answer
 * without one; the credential's own organization is that same value and is the one value a caller
 * cannot misstate.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, imported rather than restated because a literal that drifted from the catalogue
 * would name a code no catalogue row carries, which the guard resolves as disabled.
 *
 * This resolver is declared by `EmployeeRecurringExpenseModule`, beside the service it calls, so the
 * GraphQL host can scan that module for it — a resolver injects services, and a module is what reaches
 * them.
 */
@Resolver('EmployeeRecurringExpense')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
export class EmployeeRecurringExpenseResolver {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The standing costs of the caller's organization, newest arrangement first.
	 *
	 * The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the two
	 * answer one question, so the surface states it once. The month route is the third spelling of the
	 * same read, and it is folded in as well: its disjunction is stated in `filter`.
	 */
	@Query('employeeRecurringExpenses')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_VIEW)
	async employeeRecurringExpenses(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<EmployeeRecurringExpense>> {
		// The reader takes the same service method the list route calls, with the criterion that route
		// binds from its query string: the delivered clients state the organization they are working in
		// and the relations to load, and this surface states the credential's own organization and no
		// relation — the row type below declares none, so there is nothing for one to load.
		//
		// The visibility is spread *beside* `scopedQuery()` rather than into it: that reader answers the
		// organization the caller is working in, which is a criterion, while this is the soft-delete flag the
		// route's `withDeleted` query parameter carries — two different things that happen to travel to the same
		// read.
		const { items }: IPagination<EmployeeRecurringExpense> = await this.employeeRecurringExpenseService.findAll({
			...this.scopedQuery(),
			...(withDeleted ? { withDeleted: true } : {})
		});

		return buildConnection<EmployeeRecurringExpense>({
			rows: items ?? [],
			filterable: EMPLOYEE_RECURRING_EXPENSE_FILTERABLE,
			sortable: EMPLOYEE_RECURRING_EXPENSE_SORTABLE,
			defaultSort: EMPLOYEE_RECURRING_EXPENSE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One standing cost of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('employeeRecurringExpense')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async employeeRecurringExpense(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EmployeeRecurringExpense | null> {
		try {
			return await this.employeeRecurringExpenseService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many standing costs the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument
	 * of that shape, so the field states no narrowing of its own.
	 */
	@Query('employeeRecurringExpenseCount')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async employeeRecurringExpenseCount(): Promise<number> {
		return await this.employeeRecurringExpenseService.countBy();
	}

	/**
	 * Which kind of change moving an arrangement's beginning would be, and the rows in the way.
	 *
	 * **A root field of its own, because it answers a computed verdict rather than a row.** The
	 * delivered read takes the row and the beginning the caller proposes, compares them, and — when the
	 * change would move the beginning forward or backward — reads the sibling arrangements of the same
	 * parent that fall inside the gap, so the answer is a verdict plus the rows it was drawn from. No
	 * filter can express that: there is no row being narrowed, and the verdict is the delivered read's
	 * own comparison rather than a column.
	 *
	 * The verdict is carried as the contracts' own value — `NO_CHANGE`, `WITHIN_MONTH`, `REDUCE_SAFE`,
	 * `REDUCE_CONFLICT`, `INCREASE_SAFE_WITHIN_LIMIT`, `INCREASE_SAFE_OUTSIDE_LIMIT` or
	 * `INCREASE_CONFLICT` — and is never declared as a schema enum here, because the vocabulary is
	 * shared with the organization's own arrangements and with the edit the verdict steers.
	 */
	@Query('employeeRecurringExpenseStartDateUpdateType')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_VIEW)
	async employeeRecurringExpenseStartDateUpdateType(
		@Args('recurringExpenseId', { type: () => ID }) recurringExpenseId: Id,
		@Args('newStartDate', { type: () => Date }) newStartDate: Date
	): Promise<IStartUpdateTypeInfo> {
		return await this.queryBus.execute(
			new EmployeeRecurringExpenseStartDateUpdateTypeQuery({
				recurringExpenseId,
				newStartDate
			} as IFindStartDateUpdateTypeInput)
		);
	}

	/**
	 * Records a standing cost.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload: the
	 * members the caller states, the amount as the exact decimal the column stores, and the employee as
	 * the assignment the handler may stamp from the credential when the caller has no permission to
	 * choose one. The delivered handler answers the row it stored, with the parent it set to itself,
	 * which is what this field answers.
	 */
	@Mutation('createEmployeeRecurringExpense')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async createEmployeeRecurringExpense(
		@Args('input') input: ICreateEmployeeRecurringExpenseInput
	): Promise<EmployeeRecurringExpense> {
		return await this.commandBus.execute(new EmployeeRecurringExpenseCreateCommand(input as never));
	}

	/**
	 * Changes a standing cost, from the month the caller states onward.
	 *
	 * The same command the REST route dispatches, with the identifier the route reads from the path. The
	 * delivered handler decides what the change means — it may write the beginning and the value, close
	 * the arrangement and open its successor, or resolve a conflict — and answers whichever row that
	 * produced, which is what this field answers. A member the caller omits is left as it is.
	 */
	@Mutation('updateEmployeeRecurringExpense')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async updateEmployeeRecurringExpense(
		@Args('input') input: IUpdateEmployeeRecurringExpenseInput
	): Promise<EmployeeRecurringExpense> {
		const { id, ...values } = input;

		// The members the delivered edit reads are handed over as the contract's edit input, which types a
		// currency the delivered handler never writes — see the update input above for why this surface does
		// not offer one.
		return await this.commandBus.execute(
			new EmployeeRecurringExpenseEditCommand(id, values as unknown as IRecurringExpenseEditInput)
		);
	}

	/**
	 * Removes a standing cost, in one of the three ways the delivered input names.
	 *
	 * The same command the REST route dispatches, with the identifier and the deletion input the route
	 * reads out of its `data` parameter. **The delivered handler answers three different shapes** — a
	 * delete result when the whole arrangement goes, an update result when only its tail does, and the
	 * row it opened when one month is taken out of the middle — and none of the three is a shape this
	 * field could state as one answer. It therefore answers the one fact the route establishes, that the
	 * removal ran; a caller that needs the arrangement as it now stands reads it back from the
	 * connection, which is the same read the REST client would make.
	 */
	@Mutation('deleteEmployeeRecurringExpense')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async deleteEmployeeRecurringExpense(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IRecurringExpenseDeleteInput
	): Promise<boolean> {
		await this.commandBus.execute(new EmployeeRecurringExpenseDeleteCommand(id, input));

		return true;
	}

	/**
	 * Withdraws a standing cost without removing the row.
	 *
	 * No permission is stated on the field beyond the one the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level edit permission is the whole of its scope.
	 */
	@Mutation('softDeleteEmployeeRecurringExpense')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async softDeleteEmployeeRecurringExpense(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EmployeeRecurringExpense> {
		return await this.employeeRecurringExpenseService.softRemove(id);
	}

	/**
	 * Puts a withdrawn standing cost back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverEmployeeRecurringExpense')
	@Permissions(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT)
	async recoverEmployeeRecurringExpense(
		@Args('id', { type: () => ID }) id: Id
	): Promise<EmployeeRecurringExpense> {
		return await this.employeeRecurringExpenseService.softRecover(id);
	}

	/**
	 * The query DTO the delivered list route takes.
	 *
	 * That route reads `options.where` before it reads anything and the delivered clients fill it from
	 * the query string they send: the organization the payroll screen is showing, and nothing else. A
	 * GraphQL caller states no scope at all, so the object is built with the organization the credential
	 * names — the value every client of that route sends and the one value a caller cannot misstate. The
	 * caller's own narrowing still arrives in the connection's `filter`.
	 */
	private scopedQuery(): BaseQueryDTO<EmployeeRecurringExpense> {
		return {
			where: { organizationId: RequestContext.currentOrganizationId() ?? undefined }
		} as BaseQueryDTO<EmployeeRecurringExpense>;
	}
}
