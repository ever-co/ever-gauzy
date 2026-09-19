import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	DecimalString,
	ID as Id,
	IFindStartDateUpdateTypeInput,
	IOrganizationRecurringExpenseForEmployeeOutput,
	IPagination,
	IRecurringExpenseDeleteInput,
	IRecurringExpenseEditInput,
	IStartUpdateTypeInfo
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
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import {
	OrganizationRecurringExpenseCreateCommand,
	OrganizationRecurringExpenseDeleteCommand,
	OrganizationRecurringExpenseEditCommand
} from './commands';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import {
	OrganizationRecurringExpenseFindSplitExpenseQuery,
	OrganizationRecurringExpenseStartDateUpdateTypeQuery
} from './queries';

/**
 * The members `CreateOrganizationRecurringExpenseInput` declares in the schema.
 *
 * The delivered creation takes the row itself as its body — the controller declares no DTO and binds no
 * validation pipe — so the members here are the entity's own columns, which is what a write of this row
 * stores and nothing beside it. The beginning is stored twice because the delivered date arithmetic
 * reads the day, month and year rather than the instant, and `splitExpense` is a member because the
 * delivered creation stores it: whether the cost is shared is the caller's decision.
 */
export interface ICreateOrganizationRecurringExpenseInput {
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
	splitExpense?: boolean;
	parentRecurringExpenseId?: Id;
	organizationId?: Id;
}

/**
 * The members `UpdateOrganizationRecurringExpenseInput` declares in the schema.
 *
 * These are the members the delivered edit **reads**: the beginning the caller proposes, the value and
 * the category. The delivered body also accepts a currency — the contract's own edit input requires one
 * — and the delivered handler never writes it: the plain edit writes the beginning, the value and the
 * category, and the branch that closes one arrangement and opens its successor takes the currency and
 * the parent from the row it replaces. A member nothing honours is worse than no member, so it is not
 * offered.
 *
 * `startDateUpdateType` is not a member either: the delivered handler computes it from the beginning the
 * caller states, by asking the same question the `organizationRecurringExpenseStartDateUpdateType` root
 * field answers, and overwrites whatever the body carried.
 */
export interface IUpdateOrganizationRecurringExpenseInput {
	id: Id;
	startDay: number;
	startMonth: number;
	startYear: number;
	categoryName: string;
	value: DecimalString;
}

/** One row of the split read, as `OrganizationRecurringExpenseShare` declares it. */
export interface IOrganizationRecurringExpenseShare {
	recurringExpense: OrganizationRecurringExpense;
	originalValue: number;
	employeeCount: number;
}

/**
 * The fields a recurring-expense list may be filtered and sorted by, and the order it is returned in
 * when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationRecurringExpenseFilter` and
 * `OrganizationRecurringExpenseSortField` are its two renderings, and keeping the three in one file is
 * what makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * **The month route is a narrowing of this list, and every member it narrows by is here.** That route
 * answers the arrangements in force during one month — the ones that begin inside it with no end yet,
 * and the ones that begin before it and end after it — which is the disjunction written out in
 * `organization-recurring-expense.api.gql`. Both halves of it are drawn from these columns and from the
 * `or` group, so a caller loses no question by asking it here.
 *
 * The amount is `DECIMAL` rather than `NUMBER` because it is money. `deletedAt` is absent because the
 * delivered list read answers live rows only, and the tenant is absent because it is applied to the
 * criterion from the credential rather than from the caller.
 */
const ORGANIZATION_RECURRING_EXPENSE_FILTERABLE = {
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
	splitExpense: 'BOOLEAN',
	parentRecurringExpenseId: 'ID',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_RECURRING_EXPENSE_SORTABLE = [
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
 * the column the delivered month route narrows on; then the identifier, which is the key that makes the
 * order total and a cursor walk over it stable.
 */
const ORGANIZATION_RECURRING_EXPENSE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'startDate', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The standing costs one organization carries, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `OrganizationRecurringExpenseService` method, dispatches the
 * same command or executes the same query the `/api/organization-recurring-expense` route behind it
 * does, with the same payload and the same request facts.
 *
 * **The guard chain is the controller's and the permission is the absence the controller states.** The
 * controller carries `TenantPermissionGuard` on the class and no `@Permissions` anywhere — on the class
 * or on any handler — so the class here carries that guard beside the gate and every field states no
 * permission at all. A field that demanded one would refuse a caller the REST route serves, which is
 * the narrowing this delivery exists to prevent, and a field that stated none while the route stated one
 * would be a way around the permission model. The `PermissionGuard` is deliberately absent for the same
 * reason: the controller does not carry it, so a permission stated here would never be read.
 *
 * **The month route is folded into the connection and the other two reads are root fields of their
 * own.** The month route is a narrowing of the list — its criterion is a disjunction over the beginning
 * and the end of an arrangement, which the connection's `filter` states exactly — so it is a filter and
 * not a second field. The verdict read answers a computed comparison of a beginning the caller proposes
 * with the one an arrangement has, together with the rows that comparison found in the way, so there is
 * no row for a filter to narrow. The share read divides each arrangement's amount by the number of
 * people the organization employs and answers the quotient beside the whole it came from, which is a
 * figure no stored row holds — see `OrganizationRecurringExpenseShare`.
 *
 * **The organization is taken from the credential rather than stated by the caller.** Every client of
 * these routes sends the organization it is working in, and the delivered month, verdict and share
 * readers cannot answer without one; the credential's own organization is that same value and is the one
 * value a caller cannot misstate.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's own guard, so a caller with no credential is
 * refused as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, imported rather than restated because a literal that drifted from the catalogue
 * would name a code no catalogue row carries, which the guard resolves as disabled.
 *
 * This resolver is declared by `OrganizationRecurringExpenseModule`, beside the service it calls, so the
 * GraphQL host can scan that module for it — a resolver injects services, and a module is what reaches
 * them.
 */
@Resolver('OrganizationRecurringExpense')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationRecurringExpenseResolver {
	constructor(
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The standing costs of the caller's organization, newest arrangement first.
	 *
	 * The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the month
	 * route is the third spelling of the same read, so the surface states it once and the month criterion
	 * arrives in `filter`.
	 */
	@Query('organizationRecurringExpenses')
	async organizationRecurringExpenses(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OrganizationRecurringExpense>> {
		// The reader takes the same service method the list route calls, with the criterion the delivered
		// clients fill from their query string: the organization the payroll screen is showing, and the
		// order they state. This surface states the credential's own organization and applies the
		// caller's own order through the connection protocol.
		const { items }: IPagination<OrganizationRecurringExpense> =
			await this.organizationRecurringExpenseService.findAll(this.scopedQuery());

		return buildConnection<OrganizationRecurringExpense>({
			rows: items ?? [],
			filterable: ORGANIZATION_RECURRING_EXPENSE_FILTERABLE,
			sortable: ORGANIZATION_RECURRING_EXPENSE_SORTABLE,
			defaultSort: ORGANIZATION_RECURRING_EXPENSE_DEFAULT_SORT,
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
	@Query('organizationRecurringExpense')
	async organizationRecurringExpense(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationRecurringExpense | null> {
		try {
			return await this.organizationRecurringExpenseService.findOneByIdString(id);
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
	@Query('organizationRecurringExpenseCount')
	async organizationRecurringExpenseCount(): Promise<number> {
		return await this.organizationRecurringExpenseService.countBy();
	}

	/**
	 * Which kind of change moving an arrangement's beginning would be, and the rows in the way.
	 *
	 * **A root field of its own, because it answers a computed verdict rather than a row.** The delivered
	 * read takes the row and the beginning the caller proposes, compares them, and — when the change
	 * would move the beginning forward or backward — reads the sibling arrangements of the same parent
	 * that fall inside the gap. The verdict is carried as the contracts' own value and never declared as
	 * a schema enum here, because the vocabulary is shared with the employee's own arrangements.
	 */
	@Query('organizationRecurringExpenseStartDateUpdateType')
	async organizationRecurringExpenseStartDateUpdateType(
		@Args('recurringExpenseId', { type: () => ID }) recurringExpenseId: Id,
		@Args('newStartDate', { type: () => Date }) newStartDate: Date
	): Promise<IStartUpdateTypeInfo> {
		return await this.queryBus.execute(
			new OrganizationRecurringExpenseStartDateUpdateTypeQuery({
				recurringExpenseId,
				newStartDate
			} as IFindStartDateUpdateTypeInput)
		);
	}

	/**
	 * The organization's shared arrangements as one employee's share of each, for one month.
	 *
	 * **A root field of its own, and the reason is the computation.** The delivered route reads the
	 * arrangements that are shared and in force in the month, counts the people the organization employs,
	 * and divides each arrangement's amount by that count — answering the quotient, the whole it was
	 * divided from and the divisor together. The quotient is a figure no stored row holds and no filter
	 * can narrow to, so folding this read into the connection would mean answering a divided amount under
	 * the same name as a stored one with no way to tell them apart.
	 *
	 * The month is stated as the year and the calendar month's zero-based position, which is what the
	 * delivered read passes to its date constructor. Both are required because the delivered read cannot
	 * answer without them: it builds one instant from the two and measures every arrangement against it.
	 */
	@Query('organizationRecurringExpenseShares')
	async organizationRecurringExpenseShares(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('year', { type: () => Int }) year: number,
		@Args('month', { type: () => Int }) month: number
	): Promise<IOrganizationRecurringExpenseShare[]> {
		const shares: IPagination<IOrganizationRecurringExpenseForEmployeeOutput> = await this.queryBus.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery(organizationId, { year, month })
		);

		// The delivered read replaces each row's own amount with the quotient before it answers, so the
		// row carries the share and `originalValue` carries the whole it came from — which is the answer's
		// own shape and is carried as it stands.
		return (shares?.items ?? []).map((row) => ({
			recurringExpense: row as unknown as OrganizationRecurringExpense,
			originalValue: row.originalValue,
			employeeCount: row.employeeCount
		}));
	}

	/**
	 * Records a standing cost.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the row itself as its
	 * body — which is what the delivered controller binds. The delivered handler answers the row it
	 * stored with the parent it set to itself, which is what this field answers.
	 */
	@Mutation('createOrganizationRecurringExpense')
	async createOrganizationRecurringExpense(
		@Args('input') input: ICreateOrganizationRecurringExpenseInput
	): Promise<OrganizationRecurringExpense> {
		return await this.commandBus.execute(new OrganizationRecurringExpenseCreateCommand(input as never));
	}

	/**
	 * Changes a standing cost, from the month the caller states onward.
	 *
	 * The same command the REST route dispatches, with the identifier the route reads from the path. The
	 * delivered handler decides what the change means and answers whichever row that produced, which is
	 * what this field answers.
	 */
	@Mutation('updateOrganizationRecurringExpense')
	async updateOrganizationRecurringExpense(
		@Args('input') input: IUpdateOrganizationRecurringExpenseInput
	): Promise<OrganizationRecurringExpense> {
		const { id, ...values } = input;

		// The members the delivered edit reads are handed over as the contract's edit input, which types a
		// currency the delivered handler never writes — see the update input above for why this surface does
		// not offer one.
		return await this.commandBus.execute(
			new OrganizationRecurringExpenseEditCommand(id, values as unknown as IRecurringExpenseEditInput)
		);
	}

	/**
	 * Removes a standing cost, in one of the three ways the delivered input names.
	 *
	 * **The delivered handler answers three different shapes** — a delete result when the whole
	 * arrangement goes, an update result when only its tail does, and the row it opened when one month is
	 * taken out of the middle — and none of the three is a shape this field could state as one answer. It
	 * therefore answers the one fact the route establishes, that the removal ran; a caller that needs the
	 * arrangement as it now stands reads it back from the connection.
	 */
	@Mutation('deleteOrganizationRecurringExpense')
	async deleteOrganizationRecurringExpense(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IRecurringExpenseDeleteInput
	): Promise<boolean> {
		await this.commandBus.execute(new OrganizationRecurringExpenseDeleteCommand(id, input));

		return true;
	}

	/**
	 * Withdraws a standing cost without removing the row.
	 *
	 * No permission is stated on the field, and none could be: the delivered route states none of its own
	 * — the withdrawal is inherited from the CRUD base — and the controller states none on the class
	 * either.
	 */
	@Mutation('softDeleteOrganizationRecurringExpense')
	async softDeleteOrganizationRecurringExpense(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationRecurringExpense> {
		return await this.organizationRecurringExpenseService.softRemove(id);
	}

	/**
	 * Puts a withdrawn standing cost back. Unpermissioned for the same reason the withdrawal above is:
	 * the delivered route is inherited and carries no permission to mirror.
	 */
	@Mutation('recoverOrganizationRecurringExpense')
	async recoverOrganizationRecurringExpense(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationRecurringExpense> {
		return await this.organizationRecurringExpenseService.softRecover(id);
	}

	/**
	 * The query DTO the delivered list route takes.
	 *
	 * That route reads `data.findInput` and `data.order` before it reads anything, and the delivered
	 * clients fill them from the query string they send: the organization the payroll screen is showing.
	 * A GraphQL caller states no scope at all, so the object is built with the organization the
	 * credential names — the value every client of that route sends and the one value a caller cannot
	 * misstate. The caller's own narrowing still arrives in the connection's `filter`.
	 */
	private scopedQuery(): BaseQueryDTO<OrganizationRecurringExpense> {
		return {
			where: { organizationId: RequestContext.currentOrganizationId() ?? undefined }
		} as BaseQueryDTO<OrganizationRecurringExpense>;
	}
}
