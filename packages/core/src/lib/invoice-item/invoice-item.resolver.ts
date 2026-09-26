import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	DecimalString,
	ID as Id,
	IInvoiceItemCreateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemService } from './invoice-item.service';
import { InvoiceItemBulkCreateCommand } from './commands';

/** The members `CreateInvoiceItemInput` declares in the schema. */
export interface ICreateInvoiceItemInput {
	description?: string;
	price: DecimalString;
	quantity: DecimalString;
	totalValue: DecimalString;
	invoiceId?: Id;
	organizationId?: Id;
	taskId?: Id;
	employeeId?: Id;
	projectId?: Id;
	productId?: Id;
	expenseId?: Id;
	purchaseOrderLineId?: Id;
	applyTax?: boolean;
	applyDiscount?: boolean;
}

/** The members `UpdateInvoiceItemInput` declares in the schema. */
export interface IUpdateInvoiceItemInput {
	id: Id;
	description?: string;
	price?: DecimalString;
	quantity?: DecimalString;
	totalValue?: DecimalString;
	invoiceId?: Id;
	organizationId?: Id;
	taskId?: Id;
	employeeId?: Id;
	projectId?: Id;
	productId?: Id;
	expenseId?: Id;
	purchaseOrderLineId?: Id;
	applyTax?: boolean;
	applyDiscount?: boolean;
}

/**
 * The fields a line list may be filtered and sorted by, and the order it is returned in when the caller
 * states none.
 *
 * This declaration is the resolver's half of the SDL: `InvoiceItemFilter` and `InvoiceItemSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable
 * in the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the line's own row. `price`, `quantity` and `totalValue` are `DECIMAL`
 * rather than `NUMBER`: the two amounts are money, money compared as a floating-point number is money
 * that selects the wrong rows, and the quantity is the exact factor the line's total is the product
 * of, so it is compared in the family it is multiplied in.
 */
const INVOICE_ITEM_FILTERABLE = {
	id: 'ID',
	description: 'STRING',
	price: 'DECIMAL',
	quantity: 'DECIMAL',
	totalValue: 'DECIMAL',
	applyTax: 'BOOLEAN',
	applyDiscount: 'BOOLEAN',
	invoiceId: 'ID',
	taskId: 'ID',
	employeeId: 'ID',
	projectId: 'ID',
	productId: 'ID',
	expenseId: 'ID',
	purchaseOrderLineId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INVOICE_ITEM_SORTABLE = ['createdAt', 'updatedAt', 'price', 'quantity', 'totalValue'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a filter and takes the rows
 * as they come back — so this is a decision the connection makes rather than one it reproduces. It is
 * the platform's own: newest first, with the identifier as the last key so that two lines written in
 * the same millisecond still have one order between them, which is what makes a cursor walk over them
 * total. A caller that wants a document's lines in the order they are read on it states a sort of its
 * own; the order a document is printed in is the document's own concern.
 */
const INVOICE_ITEM_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * One billed line over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `InvoiceItemService` method or dispatches the same
 * command the `/api/invoice-item` routes reach.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered routes
 * carry `TenantPermissionGuard` and no `@Permissions`, so a resolver that demanded one would refuse
 * here a caller the REST route serves — two surfaces of one concept with two scopes is exactly what
 * this delivery exists to prevent. The bulk write below is the one exception, and it is the
 * controller's exception rather than this resolver's: that route states `PermissionGuard` with the
 * invoice edit permission, so the field states the same guard and the same permission.
 *
 * **The whole surface is behind the capability the catalogue declares for GraphQL.** `FeatureFlagGuard`
 * is appended to the controller's guard — after the tenant guard, so a caller with no credential is
 * refused as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here
 * because the value has to agree with the catalogue's `code` and nothing checks one string against
 * another: a literal that drifted names a code no catalogue row carries, which the guard resolves as
 * disabled, so every field below would answer `Cannot query field <name>` for every caller with
 * nothing red anywhere. It is declared once on the class, which is where the guard reads it — with
 * `getAllAndOverride` over the handler and then the class — so every field is behind it, and its
 * effect is the REST one in this protocol's vocabulary: a tenant that switched the capability off is
 * answered `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a
 * 404.
 *
 * This resolver is scanned from this domain's own module rather than from the GraphQL host — the host
 * cannot import `InvoiceItemModule` without becoming a third participant in the cycle `InvoiceModule`
 * and `EstimateEmailModule` already close — which is why `InvoiceItemModule` is also where the guard's
 * own dependency has to be reachable.
 */
@Resolver('InvoiceItem')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class InvoiceItemResolver {
	constructor(private readonly invoiceItemService: InvoiceItemService, private readonly commandBus: CommandBus) {}

	/**
	 * The billed lines of the caller's tenant, newest first.
	 *
	 * The delivered list route binds a `data` query string and reads the rows with the `findInput` and
	 * the `relations` it names. This surface has no query string to bind: the connection protocol
	 * states the same narrowing in `filter`, which is applied to the rows the service returns, so the
	 * read runs with the route's own defaults — no `findInput` and no `relations`.
	 */
	@Query('invoiceItems')
	async invoiceItems(
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
	): Promise<GraphqlConnection<InvoiceItem>> {
		const { items }: IPagination<InvoiceItem> = await this.invoiceItemService.findAll({ relations: [], ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<InvoiceItem>({
			rows: items ?? [],
			filterable: INVOICE_ITEM_FILTERABLE,
			sortable: INVOICE_ITEM_SORTABLE,
			defaultSort: INVOICE_ITEM_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One line of the caller's tenant.
	 *
	 * A line that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('invoiceItem')
	async invoiceItem(@Args('id', { type: () => ID }) id: Id): Promise<InvoiceItem | null> {
		try {
			return await this.invoiceItemService.findOneByIdString(id, { relations: [] });
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many lines the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query
	 * string to the store's own `where` and hands it to `countBy`, and the connection protocol has no
	 * argument of that shape, so the field states no narrowing of its own. The tenant is applied to the
	 * criterion by the service, from the credential rather than from the caller.
	 */
	@Query('invoiceItemCount')
	async invoiceItemCount(): Promise<number> {
		return await this.invoiceItemService.countBy();
	}

	/**
	 * Records one line.
	 *
	 * The same service call the REST route makes, with the body as it was stated: the delivered create
	 * path persists the row's columns and stamps the caller's own tenant onto it, which is why the
	 * tenant is not a member of the input.
	 */
	@Mutation('createInvoiceItem')
	async createInvoiceItem(@Args('input') input: ICreateInvoiceItemInput): Promise<InvoiceItem> {
		return await this.invoiceItemService.create(input as unknown as InvoiceItem);
	}

	/**
	 * Changes a line that exists.
	 *
	 * The delivered service reads the row before it writes it, so a caller naming a line that is not
	 * there is answered with the miss the REST route answers with rather than with a write that creates
	 * one. The identifier is the criterion and is not repeated in the columns the statement writes,
	 * which is the shape the route itself has: `:id` names the row and the body carries what changes.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateInvoiceItem` may return.
	 */
	@Mutation('updateInvoiceItem')
	async updateInvoiceItem(@Args('input') input: IUpdateInvoiceItemInput): Promise<InvoiceItem> {
		const { id, ...values } = input;

		await this.invoiceItemService.update(id, values as unknown as QueryDeepPartialEntity<InvoiceItem>);

		return await this.invoiceItemService.findOneByIdString(id);
	}

	/**
	 * Removes a line outright.
	 *
	 * The same service call the REST route makes. The delivered call answers the store's own delete
	 * result — a statement about the write, `{ affected }` — which is not a row and not what a field
	 * named `deleteInvoiceItem` may return; the field answers the one fact the call establishes, that
	 * the removal ran.
	 */
	@Mutation('deleteInvoiceItem')
	async deleteInvoiceItem(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.invoiceItemService.delete(id);

		return true;
	}

	/**
	 * Withdraws a line without removing the row. The delivered route declares no option of its own, so
	 * the field states none either.
	 */
	@Mutation('softDeleteInvoiceItem')
	async softDeleteInvoiceItem(@Args('id', { type: () => ID }) id: Id): Promise<InvoiceItem> {
		return await this.invoiceItemService.softRemove(id);
	}

	/**
	 * Puts a withdrawn line back.
	 */
	@Mutation('recoverInvoiceItem')
	async recoverInvoiceItem(@Args('id', { type: () => ID }) id: Id): Promise<InvoiceItem> {
		return await this.invoiceItemService.softRecover(id);
	}

	/**
	 * Stores a document's whole line set at once.
	 *
	 * The same command the REST route dispatches, with the identifier the path states and the lines the
	 * body states. **It is a replacement rather than an append**: the delivered handler removes the
	 * lines the named document already has and then stores the stated ones, so the answer is the set
	 * that was stored and the set the document had is gone.
	 *
	 * The cast states a difference rather than hiding one: the command's own input type requires every
	 * line to carry a description, while the delivered validation treats it as optional — the route's
	 * own DTO marks it optional and the column is nullable — so the schema declares it optional and the
	 * cast carries the body through as it was validated rather than tightening the surface to a type the
	 * delivered write does not enforce.
	 *
	 * This is the one field of this resource that carries a permission, because its route is the one
	 * route that does.
	 */
	@Mutation('createInvoiceItemsInBulk')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async createInvoiceItemsInBulk(
		@Args('invoiceId', { type: () => ID }) invoiceId: Id,
		@Args('input') input: ICreateInvoiceItemInput[]
	): Promise<InvoiceItem[]> {
		return await this.commandBus.execute(
			new InvoiceItemBulkCreateCommand(invoiceId, input as unknown as IInvoiceItemCreateInput[])
		);
	}
}
