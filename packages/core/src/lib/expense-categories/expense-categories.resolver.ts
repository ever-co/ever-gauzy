import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ExpenseCategoryCreateCommand, ExpenseCategoryUpdateCommand } from './commands';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';

/** The members `CreateExpenseCategoryInput` declares in the schema. */
export interface ICreateExpenseCategoryInput {
	name: string;
	organizationId?: Id;
	tagIds?: Id[];
}

/** The members `UpdateExpenseCategoryInput` declares in the schema. */
export interface IUpdateExpenseCategoryInput extends ICreateExpenseCategoryInput {
	id: Id;
}

/**
 * The fields a category list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ExpenseCategoryFilter` and
 * `ExpenseCategorySortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * The two collections the row carries are in neither. The categories a tenant files its costs under
 * are read as the vocabulary itself, and neither the expenses filed under a category nor the tags
 * attached to it is joined by any read behind this surface: the list read is handed its criterion from
 * a query string and its relations from none, so a condition on either could only ever select the
 * empty set.
 */
const EXPENSE_CATEGORY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const EXPENSE_CATEGORY_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store the criterion its query
 * string carried and takes the rows as they come back — so this is a decision the connection has to
 * make rather than one it reproduces. The name is what a filing vocabulary is scanned by, so the
 * categories stand in it; the identifier follows, because a vocabulary may hold two categories a
 * tenant named alike and the last key is what makes the order total and a cursor walk over it stable.
 */
const EXPENSE_CATEGORY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The vocabulary an expense is filed under, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ExpenseCategoriesService` method or dispatches the same
 * command the `/api/expense-categories` route behind it does, with the same payload and the same
 * request facts.
 *
 * **The guard chain and the permission are the controller's, field by field.** The class carries what
 * the controller class carries — both guards, and the class-level edit permission — and every field
 * then states the permission its own route runs under, so a field is never narrower or wider than the
 * route it mirrors. Three cases read oddly and are nevertheless the parity: the node read, the count
 * and the three removals are inherited from the CRUD base without a permission of their own, so they
 * run under the controller's class-level edit permission, and the fields state that same permission
 * rather than stating nothing. Only the list states the view permission, because only its routes do —
 * `GET /` and the inherited paginated spelling alike.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here
 * because the value has to agree with the catalogue's `code` and nothing checks one string against
 * another: a literal that drifted names a code no catalogue row carries, which the guard resolves as
 * disabled, so every field below would answer `Cannot query field <name>` for every caller with
 * nothing red anywhere. One statement on the class is what puts every field behind it.
 *
 * This resolver is declared by `ExpenseCategoriesModule`, beside the service it calls, so the GraphQL
 * host can scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('ExpenseCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
export class ExpenseCategoriesResolver {
	constructor(
		private readonly expenseCategoriesService: ExpenseCategoriesService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The categories of the caller's tenant, in the vocabulary's own name order.
	 *
	 * The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the two
	 * answer one question, so the surface states it once: a second root field for the paginated spelling
	 * would be a second surface that could disagree with this one, and the connection's own
	 * `limit`/`offset` already are the page it performs.
	 */
	@Query('expenseCategories')
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	async expenseCategories(
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
	): Promise<GraphqlConnection<ExpenseCategory>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<ExpenseCategory>;
		const { items }: IPagination<ExpenseCategory> = await this.expenseCategoriesService.findAll(options);

		return buildConnection<ExpenseCategory>({
			rows: items ?? [],
			filterable: EXPENSE_CATEGORY_FILTERABLE,
			sortable: EXPENSE_CATEGORY_SORTABLE,
			defaultSort: EXPENSE_CATEGORY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One category of the caller's tenant.
	 *
	 * A category that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('expenseCategory')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async expenseCategory(@Args('id', { type: () => ID }) id: Id): Promise<ExpenseCategory | null> {
		try {
			return await this.expenseCategoriesService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many categories the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument
	 * of that shape, so the field states no narrowing of its own. The tenant is applied to the criterion
	 * by the service, from the credential rather than from the caller.
	 */
	@Query('expenseCategoryCount')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async expenseCategoryCount(): Promise<number> {
		return await this.expenseCategoriesService.countBy();
	}

	/**
	 * Files a category.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload: the
	 * name the route validates, the organization the row is filed under and the facets as the
	 * identifiers the pivot is written from. The tenant is stamped by the service from the credential
	 * and is never stated by the caller.
	 */
	@Mutation('createExpenseCategory')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async createExpenseCategory(@Args('input') input: ICreateExpenseCategoryInput): Promise<ExpenseCategory> {
		return await this.commandBus.execute(new ExpenseCategoryCreateCommand(this.payload(input) as never));
	}

	/**
	 * Renames a category, or files it under another organization.
	 *
	 * The same command the REST route dispatches, carrying the identifier the route reads from the path
	 * and spreads beside the body. The delivered handler wraps every failure of this write into a bad
	 * request; that wrapper is the handler's own translation and not part of the write, so it is not
	 * restated here — what reaches the caller is whatever the write raised, rendered by the platform's
	 * error contract with the code and the status the condition actually has.
	 */
	@Mutation('updateExpenseCategory')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async updateExpenseCategory(@Args('input') input: IUpdateExpenseCategoryInput): Promise<ExpenseCategory> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new ExpenseCategoryUpdateCommand(id, this.payload(values) as never)
		);
	}

	/**
	 * Removes a category outright.
	 *
	 * The same service method the inherited removal route calls. The delivered store answers its own
	 * delete result — a statement about the write, `{ affected }` — which is not a row and not what a
	 * field named `deleteExpenseCategory` may return; the field answers the one fact the removal
	 * establishes, that it ran. A category an expense still points at is the store's own constraint to
	 * refuse, and this field does not pre-empt it.
	 */
	@Mutation('deleteExpenseCategory')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async deleteExpenseCategory(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.expenseCategoriesService.delete(id);

		return true;
	}

	/**
	 * Withdraws a category without removing the row.
	 *
	 * No permission is stated on the field beyond the one the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level edit permission is the whole of its scope.
	 */
	@Mutation('softDeleteExpenseCategory')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async softDeleteExpenseCategory(@Args('id', { type: () => ID }) id: Id): Promise<ExpenseCategory> {
		return await this.expenseCategoriesService.softRemove(id);
	}

	/**
	 * Puts a withdrawn category back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverExpenseCategory')
	@Permissions(PermissionsEnum.ORG_EXPENSES_EDIT)
	async recoverExpenseCategory(@Args('id', { type: () => ID }) id: Id): Promise<ExpenseCategory> {
		return await this.expenseCategoriesService.softRecover(id);
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The facets are handed over as the identifiers the pivot is written from, never as tag rows: the
	 * delivered write stores the membership, which is the pair of identifiers. The tenant is
	 * deliberately not among the members the caller states, because the service stamps the caller's own
	 * tenant onto the row and refuses a row that belongs to another one.
	 */
	private payload(
		input: Omit<ICreateExpenseCategoryInput, 'id'> | IUpdateExpenseCategoryInput
	): Record<string, unknown> {
		const { tagIds, ...values } = input;

		return {
			...values,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		};
	}
}
