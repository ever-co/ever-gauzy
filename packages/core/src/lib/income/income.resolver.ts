import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { DecimalString, ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context';
import { EmployeeService } from '../employee/employee.service';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IncomeCreateCommand, IncomeDeleteCommand, IncomeUpdateCommand } from './commands';
import { Income } from './income.entity';
import { IncomeService } from './income.service';

/**
 * The members `CreateIncomeInput` declares in the schema.
 *
 * The client the income is billed to is stated as an identifier: the delivered create body carries that
 * identifier and the client row beside it, but what a write of this row persists is the foreign key, and
 * the schema declares no object type for a party — it belongs to the resource that owns it.
 */
export interface ICreateIncomeInput {
	amount: DecimalString;
	clientId: Id;
	currency?: string;
	valueDate?: Date;
	notes?: string;
	isBonus?: boolean;
	reference?: string;
	organizationId?: Id;
	employeeId?: Id;
	tagIds?: Id[];
}

/**
 * The members `UpdateIncomeInput` declares in the schema.
 *
 * The employee is deliberately not among them: the delivered edit body drops that member while the
 * create keeps it, so an input here that carried it would offer a member no write of this route
 * honours.
 */
export interface IUpdateIncomeInput {
	id: Id;
	amount: DecimalString;
	clientId: Id;
	currency?: string;
	valueDate?: Date;
	notes?: string;
	isBonus?: boolean;
	reference?: string;
	organizationId?: Id;
	tagIds?: Id[];
}

/**
 * The fields an income list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `IncomeFilter` and `IncomeSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the schema
 * but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every amount is `DECIMAL` rather than `NUMBER` because it is money: an income compared as a
 * floating-point number is an income that selects the wrong rows. `deletedAt` is absent because the
 * delivered list read answers live rows only, and the tenant and the organization are absent because
 * both are applied to the criterion from the credential rather than from the caller. The tags and the
 * client are absent for a third reason: the delivered list read is handed its relations from a query
 * string this surface has no spelling for, so it runs with none, and a condition on a collection the row
 * does not carry could only ever select the empty set.
 */
const INCOME_FILTERABLE = {
	id: 'ID',
	valueDate: 'DATE',
	amount: 'DECIMAL',
	currency: 'STRING',
	notes: 'STRING',
	isBonus: 'BOOLEAN',
	reference: 'STRING',
	clientId: 'ID',
	employeeId: 'ID',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INCOME_SORTABLE = ['createdAt', 'updatedAt', 'valueDate', 'amount'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a criterion and takes the rows
 * as they come back — so this is a decision the connection has to make rather than one it reproduces. It
 * is the book's own order: the date the income belongs to, newest first, which is the column the
 * delivered books are read by. The creation instant and then the identifier follow it, because a book
 * has rows that share a date and the last key is what makes the order total and a cursor walk over it
 * stable. `valueDate` is nullable and the connection's own rule places an absent value first under a
 * descending walk, so a row whose date was never recorded stands at the head of the book rather than
 * silently inside it.
 */
const INCOME_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'valueDate', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The income book over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `IncomeService` method or dispatches the same command the
 * `/api/income` route behind it does, with the same payload and the same request facts. An income is the
 * other half of the expense book — the same rows with the sign reversed, filed against a party rather
 * than a vendor — so a client that speaks this protocol reads what the organization earned the same way
 * it reads what it spent.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards, and the class-level edit permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it mirrors.
 * Two cases read oddly and are nevertheless the parity: the create, the edit and the removal are declared
 * on the controller without a permission of their own, so they run under the controller's class-level
 * edit permission, and the fields state that same permission rather than stating nothing; and the
 * withdrawal and the restoration are inherited from the CRUD base and run under the same permission for
 * the same reason. Every read states the view permission, because every read route states one.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused as
 * a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here because
 * the value has to agree with the catalogue's `code` and nothing checks one string against another: a
 * literal that drifted names a code no catalogue row carries, which the guard resolves as disabled, so
 * every field below would answer `Cannot query field <name>` for every caller with nothing red anywhere.
 * One statement on the class is what puts every field behind it.
 *
 * **The amounts are the row's own.** Nothing here rescales, rounds or reformats an amount: the column is
 * read through the platform's numeric transformer and the value travels as it was read — and written as
 * the exact decimal the schema states it as, so an income recorded over this protocol stores the digits
 * it was given rather than a binary fraction that approximates them.
 *
 * This resolver is declared by `IncomeModule`, beside the service it calls, so the GraphQL host can scan
 * that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('Income')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
export class IncomeResolver {
	constructor(
		private readonly incomeService: IncomeService,
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The incomes of the caller's tenant, newest first.
	 *
	 * The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
	 * question, so the surface states it once. The paginated spelling's two narrowings survive the fold
	 * and are stated in the connection's own vocabulary: the note pattern as `ilike` on `notes`, and the
	 * date window as `between` on `valueDate`. Its third is a tag membership, and it is not offered: the
	 * delivered list read is handed its relations from a query string this surface has no spelling for,
	 * so it runs with none and a condition on the tags collection could only ever match the empty set.
	 */
	@Query('incomes')
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	async incomes(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Income>> {
		// The reader takes the `findInput`, the `relations` and the `filterDate` the list route binds its
		// `data` query parameter to. This surface has no query string to bind: the connection protocol
		// states the same narrowing in `filter`, which is applied to the rows the service returns, so the
		// read runs with the route's own defaults — no criterion, no relation and no date window.
		const { items }: IPagination<Income> = await this.incomeService.findAllIncomes({});

		return buildConnection<Income>({
			rows: items ?? [],
			filterable: INCOME_FILTERABLE,
			sortable: INCOME_SORTABLE,
			defaultSort: INCOME_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One income of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the other
	 * protocol's vocabulary.
	 */
	@Query('income')
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	async income(@Args('id', { type: () => ID }) id: Id): Promise<Income | null> {
		try {
			return await this.incomeService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many incomes the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument of
	 * that shape, so the field states no narrowing of its own. The tenant — and, for a caller who may not
	 * choose the employee, the caller's own employee — are applied to the criterion by the service, from
	 * the credential rather than from the caller.
	 */
	@Query('incomeCount')
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	async incomeCount(): Promise<number> {
		return await this.incomeService.countBy();
	}

	/**
	 * The caller's own incomes.
	 *
	 * **A root field of its own rather than a filter on `incomes`, and the reason is who is asking.** The
	 * delivered route resolves the employee row from the caller's user identifier and narrows the read to
	 * it — refusing a caller who has no employee row — which is a narrowing by the credential rather than
	 * a statement a caller makes: the connection's `filter` could state an employee identifier only if the
	 * caller already knew its own. The date the route reads out of its `data` parameter is stated here,
	 * and the relations that parameter also carries is not, because the row type this surface answers
	 * declares none.
	 */
	@Query('myIncomes')
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	async myIncomes(
		@Args('filterDate', { type: () => Date, nullable: true }) filterDate?: Date
	): Promise<Income[]> {
		// The route looks the employee row up by the caller's user identifier, so a caller without one is
		// refused rather than answered an empty list — which is the delivered read's own behaviour.
		const employee = await this.employeeService.findOneByWhereOptions({
			userId: RequestContext.currentUserId()
		});

		const { items }: IPagination<Income> = await this.incomeService.findAllIncomes(
			{ where: { employeeId: employee.id } },
			filterDate?.toISOString()
		);

		return items ?? [];
	}

	/**
	 * Records an income.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload: the
	 * members the caller states, the facets as the identifiers the pivot row is written from, and the
	 * amount as the exact decimal the column stores. The tenant is stamped by the service from the
	 * credential and the caller's own employee may be stamped beside it, which is why neither is a member
	 * the caller can choose freely.
	 */
	@Mutation('createIncome')
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	async createIncome(@Args('input') input: ICreateIncomeInput): Promise<Income> {
		return await this.commandBus.execute(new IncomeCreateCommand(this.writePayload(input) as never));
	}

	/**
	 * Changes an income that exists.
	 *
	 * The delivered edit reaches the same write the create does, carrying the identifier in the path and
	 * the body together, so the field states one identifier and leaves neither reading undefined. Its
	 * answer is that write's answer — the row — and a member the caller omits is left as it is; see
	 * `UpdateIncomeInput`, which also states what an identifier naming no row does.
	 */
	@Mutation('updateIncome')
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	async updateIncome(@Args('input') input: IUpdateIncomeInput): Promise<Income> {
		const { id, ...values } = input;

		return await this.commandBus.execute(new IncomeUpdateCommand(id, this.writePayload(values) as never));
	}

	/**
	 * Removes an income outright.
	 *
	 * The same command the REST route dispatches. The delivered handler answers its own delete result — a
	 * statement about the write, `{ affected }` — which is not a row and not what a field named
	 * `deleteIncome` may return; the field answers the one fact the removal establishes, that it ran.
	 *
	 * The employee the route reads out of its query string is the row whose recorded averages the
	 * delivered handler refreshes beside the removal. It is optional here as it is there, and a caller
	 * that states none gets the removal without the refresh — the row is gone either way.
	 */
	@Mutation('deleteIncome')
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	async deleteIncome(
		@Args('id', { type: () => ID }) id: Id,
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id
	): Promise<boolean> {
		await this.commandBus.execute(new IncomeDeleteCommand(employeeId, id));

		return true;
	}

	/**
	 * Withdraws an income without removing the row.
	 *
	 * No permission is stated on the field beyond the one the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level edit permission is the whole of its scope.
	 */
	@Mutation('softDeleteIncome')
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	async softDeleteIncome(@Args('id', { type: () => ID }) id: Id): Promise<Income> {
		return await this.incomeService.softRemove(id);
	}

	/**
	 * Puts a withdrawn income back. Its permission is the withdrawal's, for the same reason: the delivered
	 * route carries none of its own to mirror.
	 */
	@Mutation('recoverIncome')
	@Permissions(PermissionsEnum.ORG_INCOMES_EDIT)
	async recoverIncome(@Args('id', { type: () => ID }) id: Id): Promise<Income> {
		return await this.incomeService.softRecover(id);
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The facets are handed over as the identifiers the pivot is written from, never as tag rows: the
	 * delivered write stores the membership, which is the pair of identifiers. The tenant is deliberately
	 * not among the members the caller states, because the service stamps the caller's own tenant onto the
	 * row and refuses a row that belongs to another one. No amount is touched here: the exact decimal the
	 * caller stated is the value the write receives.
	 */
	private writePayload(
		input: Omit<ICreateIncomeInput, 'id'> | IUpdateIncomeInput
	): Record<string, unknown> {
		const { tagIds, ...values } = input;

		return {
			...values,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		};
	}
}
