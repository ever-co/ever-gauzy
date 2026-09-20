import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	DecimalString,
	ID as Id,
	IExpense,
	IExpenseCreateInput,
	IPagination,
	ISplitExpenseFindInput,
	ISplitExpenseOutput,
	PermissionsEnum
} from '@gauzy/contracts';
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
import { ExpenseCreateCommand, ExpenseDeleteCommand, ExpenseUpdateCommand } from './commands';
import { Expense } from './expense.entity';
import { ExpenseService } from './expense.service';
import { FindSplitExpenseQuery } from './queries';

/**
 * The members `CreateExpenseInput` declares in the schema.
 *
 * The related rows the delivered body may state beside their identifiers — the vendor, the category,
 * the project, the contact and the employee — are stated only as identifiers: the schema declares no
 * object type for any of them, because each belongs to the resource that owns it, and the identifier is
 * what a write of this row persists anyway.
 */
export interface ICreateExpenseInput {
	amount: DecimalString;
	currency?: string;
	typeOfExpense?: string;
	valueDate?: Date;
	notes?: string;
	reference?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: DecimalString;
	receipt?: string;
	splitExpense?: boolean;
	status?: string;
	organizationId?: Id;
	employeeId?: Id;
	vendorId?: Id;
	categoryId?: Id;
	projectId?: Id;
	organizationContactId?: Id;
	tagIds?: Id[];
}

/**
 * The members `UpdateExpenseInput` declares in the schema.
 *
 * The employee is deliberately not among them: the delivered edit body drops that member while the
 * create keeps it, so an input here that carried it would offer a member no write of this route
 * honours.
 */
export interface IUpdateExpenseInput {
	id: Id;
	amount: DecimalString;
	currency?: string;
	typeOfExpense?: string;
	valueDate?: Date;
	notes?: string;
	reference?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: DecimalString;
	receipt?: string;
	splitExpense?: boolean;
	status?: string;
	organizationId?: Id;
	vendorId?: Id;
	categoryId?: Id;
	projectId?: Id;
	organizationContactId?: Id;
	tagIds?: Id[];
}

/**
 * One row of a split read, as `ExpenseSplitRow` declares it.
 *
 * The row is the delivered answer's own expense row — the read divides the amount on the rows the
 * platform splits and leaves every other row as it found it — and the two members beside it are the
 * whole that was divided and the number of people it was divided among. Both are absent on a row that
 * was not divided, which is why the type states them as nullable.
 */
export interface IExpenseSplitRow {
	expense: Expense;
	originalValue?: number;
	employeeCount?: number;
}

/**
 * The fields an expense list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ExpenseFilter` and `ExpenseSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row, and every amount is `DECIMAL` rather than `NUMBER` because it is
 * money: an amount compared as a floating-point number is an amount that selects the wrong rows.
 * `deletedAt` is absent because the delivered list read answers live rows only, and the tenant and the
 * organization are absent because both are applied to the criterion from the credential rather than
 * from the caller. The relations are absent for a third reason: the delivered list read is handed its
 * `relations` from a query string this surface has no spelling for, so it runs with none, and a
 * condition on a collection the row does not carry could only ever select the empty set.
 */
const EXPENSE_FILTERABLE = {
	id: 'ID',
	valueDate: 'DATE',
	amount: 'DECIMAL',
	currency: 'STRING',
	typeOfExpense: 'STRING',
	notes: 'STRING',
	purpose: 'STRING',
	taxType: 'STRING',
	taxLabel: 'STRING',
	rateValue: 'DECIMAL',
	receipt: 'STRING',
	reference: 'STRING',
	splitExpense: 'BOOLEAN',
	status: 'STRING',
	employeeId: 'ID',
	vendorId: 'ID',
	categoryId: 'ID',
	projectId: 'ID',
	organizationContactId: 'ID',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EXPENSE_SORTABLE = ['createdAt', 'updatedAt', 'valueDate', 'amount', 'status'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. It is the expense book's own order: the date the cost belongs to, newest first, which is
 * the column the delivered report read orders the same rows by. The creation instant and then the
 * identifier follow it, because a book has rows that share a date and the last key is what makes the
 * order total and a cursor walk over it stable. `valueDate` is nullable and the connection's own rule
 * places an absent value first under a descending walk, so a row whose date was never recorded stands
 * at the head of the book rather than silently inside it.
 */
const EXPENSE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'valueDate', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The expense book over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `ExpenseService` method, dispatches the same command or
 * executes the same query the `/api/expense` route behind it does, with the same payload and the same
 * request facts. What a caller records here is the same row a REST caller records, in the same book.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards, and the class-level edit permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it mirrors.
 * Three cases read oddly and are nevertheless the parity: the create, the edit and the removal are
 * declared on the controller without a permission of their own, so they run under the controller's
 * class-level edit permission, and the fields state that same permission rather than stating nothing.
 * The withdrawal and the restoration are inherited from the CRUD base and run under the same permission
 * for the same reason, and every read states the view permission because every read route states one.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here
 * because the value has to agree with the catalogue's `code` and nothing checks one string against
 * another: a literal that drifted names a code no catalogue row carries, which the guard resolves as
 * disabled, so every field below would answer `Cannot query field <name>` for every caller with nothing
 * red anywhere. One statement on the class is what puts every field behind it — the guard reads the
 * metadata with `getAllAndOverride` over the handler and then the class — and its effect is the REST one
 * in this protocol's vocabulary: a tenant that switched the capability off is answered
 * `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * **The amounts are the row's own.** Nothing here rescales, rounds or reformats an amount: the columns
 * are read through the platform's numeric transformer and the values travel as they were read — and
 * written as the exact decimals the schema states them as, so an expense recorded over this protocol
 * stores the digits it was given rather than a binary fraction that approximates them. The one figure on
 * this surface that is not the row's own is the share the split reads answer, and it is documented as
 * the computation it is rather than presented as a stored amount.
 *
 * This resolver is declared by `ExpenseModule`, beside the service it calls, so the GraphQL host can
 * scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('Expense')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
export class ExpenseResolver {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The expenses of the caller's tenant, newest cost first.
	 *
	 * The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the two
	 * answer one question, so the surface states it once: a second root field for the paginated spelling
	 * would be a second surface that could disagree with this one. The paginated spelling's three
	 * narrowings survive the fold and are stated in the connection's own vocabulary: the note pattern as
	 * `ilike` on `notes`, the purpose pattern as `ilike` on `purpose`, and the date window as `between`
	 * on `valueDate`. Its fourth is a tag membership, and it is not offered: the delivered list read is
	 * handed its `relations` from a query string this surface has no spelling for, so it runs with none
	 * and a condition on the tags collection could only ever match the empty set.
	 */
	@Query('expenses')
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	async expenses(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Expense>> {
		// The reader takes the `findInput`, the `relations` and the `filterDate` the list route binds its
		// `data` query parameter to. This surface has no query string to bind: the connection protocol
		// states the same narrowing in `filter`, which is applied to the rows the service returns, so the
		// read runs with the route's own defaults — no criterion, no relation and no date window.
		const { items }: IPagination<Expense> = await this.expenseService.findAllExpenses({});

		return buildConnection<Expense>({
			rows: items ?? [],
			filterable: EXPENSE_FILTERABLE,
			sortable: EXPENSE_SORTABLE,
			defaultSort: EXPENSE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One expense of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('expense')
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	async expense(@Args('id', { type: () => ID }) id: Id): Promise<Expense | null> {
		try {
			return await this.expenseService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many expenses the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument
	 * of that shape, so the field states no narrowing of its own. The tenant — and, for a caller who may
	 * not choose the employee, the caller's own employee — are applied to the criterion by the service,
	 * from the credential rather than from the caller.
	 */
	@Query('expenseCount')
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	async expenseCount(): Promise<number> {
		return await this.expenseService.countBy();
	}

	/**
	 * The expenses of one employee, including the organization's split expenses.
	 *
	 * **A root field of its own rather than a filter on `expenses`, and the reason is the read rather
	 * than a preference.** The delivered route executes a query of its own: it joins the organization's
	 * shared expenses to the employee's own in one criterion, counts the organization's employees, and
	 * then divides the amount of every row the platform splits by that count — so the rows it answers
	 * carry a figure no stored row holds and two members no read of the connection produces. The
	 * connection's `filter` narrows rows and cannot state any of that, and folding it in would mean
	 * answering the divided figure under the same name as the stored one with no way to tell them apart.
	 *
	 * The employee is the path segment, and the date the route reads out of its `data` parameter is
	 * stated here. The `relations` that parameter also carries is not: the row type this surface answers
	 * declares no relation, so there is nothing for one to load.
	 */
	@Query('splitExpensesByEmployee')
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	async splitExpensesByEmployee(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('filterDate', { type: () => Date, nullable: true }) filterDate?: Date
	): Promise<IExpenseSplitRow[]> {
		return this.splitRows(employeeId, filterDate);
	}

	/**
	 * The caller's own expenses, including the organization's split expenses.
	 *
	 * The same read the route above performs, with the employee resolved from the credential rather than
	 * stated by the caller — the delivered route looks the row up by the caller's user identifier and
	 * refuses a caller who has none, which is a fact about who is asking rather than a narrowing the
	 * connection's `filter` could state. The date is read from the request's own `data` parameter on the
	 * route and is stated here for the same reason it is above.
	 */
	@Query('mySplitExpenses')
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	async mySplitExpenses(
		@Args('filterDate', { type: () => Date, nullable: true }) filterDate?: Date
	): Promise<IExpenseSplitRow[]> {
		const employee = await this.employeeService.findOneByWhereOptions({
			userId: RequestContext.currentUserId()
		});

		return this.splitRows(employee.id, filterDate);
	}

	/**
	 * The rows a split read answers, in the shape this surface declares.
	 *
	 * The read answers the employee's own expenses beside the organization's shared ones and leaves the
	 * rows it does not divide untouched, so the two members a divided row carries are absent on the
	 * others — which is the delivered answer's own shape and is carried as it stands rather than
	 * normalised into a figure every row would appear to have.
	 *
	 * The date the read narrows by is handed over as the instant's own spelling rather than as the
	 * instant, because that is the shape the delivered member has: the route reads a text out of its
	 * `data` parameter and the read parses it with the platform's date library. A field that stated a
	 * date and handed the read an object would be a second shape for one member, and the month the read
	 * narrows to is the same either way.
	 */
	private async splitRows(employeeId: Id, filterDate?: Date): Promise<IExpenseSplitRow[]> {
		const rows: IPagination<ISplitExpenseOutput> = await this.queryBus.execute(
			new FindSplitExpenseQuery({
				employeeId,
				filterDate: filterDate?.toISOString()
			} as ISplitExpenseFindInput)
		);

		return (rows?.items ?? []).map((row) => ({
			expense: row as unknown as Expense,
			originalValue: row.originalValue,
			employeeCount: row.employeeCount
		}));
	}

	/**
	 * Records an expense.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload: the
	 * members the caller states, the facets as the identifiers the pivot row is written from, and the
	 * amount as the exact decimal the column stores. The tenant is stamped by the service from the
	 * credential and the caller's own employee may be stamped beside it, which is why neither is a member
	 * the caller can choose freely.
	 */
	@Mutation('createExpense')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async createExpense(@Args('input') input: ICreateExpenseInput): Promise<Expense> {
		return await this.commandBus.execute(
			new ExpenseCreateCommand(this.writePayload(input) as unknown as IExpenseCreateInput)
		);
	}

	/**
	 * Changes an expense that exists.
	 *
	 * The delivered edit reaches the same write the create does, carrying the identifier in the path and
	 * the body together, so the field states one identifier and leaves neither reading undefined. Its
	 * answer is that write's answer — the row — and a member the caller omits is left as it is.
	 *
	 * The delivered route wraps every failure of this write into a bad request. That wrapper is the
	 * controller's own translation of the failure and not part of the write, so it is not restated here:
	 * this field lets the failure the service raised reach the caller, which the platform's error
	 * contract renders with the code and the status the condition actually has.
	 */
	@Mutation('updateExpense')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async updateExpense(@Args('input') input: IUpdateExpenseInput): Promise<Expense> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new ExpenseUpdateCommand(id, this.writePayload(values) as unknown as IExpense)
		);
	}

	/**
	 * Removes an expense outright.
	 *
	 * The same command the REST route dispatches. The delivered handler answers its own delete result —
	 * a statement about the write, `{ affected }` — which is not a row and not what a field named
	 * `deleteExpense` may return; the field answers the one fact the removal establishes, that it ran.
	 *
	 * The employee the route reads out of its query string is the row whose recorded average the
	 * delivered handler refreshes beside the removal. It is optional here as it is there, and a caller
	 * that states none gets the removal without the refresh — the row is gone either way.
	 */
	@Mutation('deleteExpense')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async deleteExpense(
		@Args('id', { type: () => ID }) id: Id,
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id
	): Promise<boolean> {
		await this.commandBus.execute(new ExpenseDeleteCommand(employeeId, id));

		return true;
	}

	/**
	 * Withdraws an expense without removing the row.
	 *
	 * No permission is stated on the field beyond the one the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level edit permission is the whole of its scope. The delivered route passes the
	 * service the empty option list that leaves, so the field states none either.
	 */
	@Mutation('softDeleteExpense')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async softDeleteExpense(@Args('id', { type: () => ID }) id: Id): Promise<Expense> {
		return await this.expenseService.softRemove(id);
	}

	/**
	 * Puts a withdrawn expense back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverExpense')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async recoverExpense(@Args('id', { type: () => ID }) id: Id): Promise<Expense> {
		return await this.expenseService.softRecover(id);
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The facets are handed over as the identifiers the pivot is written from, never as tag rows: the
	 * delivered write stores the membership, which is the pair of identifiers. The tenant is deliberately
	 * not among the members the caller states, because the service stamps the caller's own tenant onto
	 * the row and refuses a row that belongs to another one. No amount is touched here: the exact decimal
	 * the caller stated is the value the write receives.
	 */
	private writePayload(
		input: Omit<ICreateExpenseInput, 'id'> | IUpdateExpenseInput
	): Record<string, unknown> {
		const { tagIds, ...values } = input;

		return {
			...values,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		};
	}
}
