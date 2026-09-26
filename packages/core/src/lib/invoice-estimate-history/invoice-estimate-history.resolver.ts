import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';

/** The members `CreateInvoiceEstimateHistoryInput` declares in the schema. */
export interface ICreateInvoiceEstimateHistoryInput {
	action: string;
	title?: string;
	userId?: Id;
	invoiceId?: Id;
	organizationId?: Id;
}

/** The members `UpdateInvoiceEstimateHistoryInput` declares in the schema. */
export interface IUpdateInvoiceEstimateHistoryInput extends Partial<ICreateInvoiceEstimateHistoryInput> {
	id: Id;
}

/**
 * The fields a log list may be filtered and sorted by, and the order it is returned in when the caller
 * states none.
 *
 * This declaration is the resolver's half of the SDL: `InvoiceEstimateHistoryFilter` and
 * `InvoiceEstimateHistorySortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `deletedAt` is in neither, because the delivered list read answers live rows only, so the column is
 * absent on every row this connection holds. The two relations are in neither, because they are not
 * members: a filter compares against a value the row carries, and the relation is not joined by any read
 * this surface performs.
 */
const INVOICE_ESTIMATE_HISTORY_FILTERABLE = {
	id: 'ID',
	action: 'STRING',
	title: 'STRING',
	userId: 'ID',
	invoiceId: 'ID',
	organizationId: 'ID',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INVOICE_ESTIMATE_HISTORY_SORTABLE = ['createdAt', 'updatedAt', 'action', 'title'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read applies no order of its own — the CRUD base hands the store the criterion the
 * caller bound and takes the rows as they come back — so this is a decision the connection has to make
 * rather than one it reproduces: newest entry first, because a log is read from what happened last, then
 * the identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const INVOICE_ESTIMATE_HISTORY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The invoice estimate history over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `InvoiceEstimateHistoryService` method the
 * `/api/invoice-estimate-history` routes call — including the five lifecycle moves whose routes the
 * controller inherits from the CRUD base rather than declaring.
 *
 * **The guard chain and the permission are the controller's, field by field.** The controller declares
 * nothing on its class: its list route states `TenantPermissionGuard`, `PermissionGuard` and
 * `INVOICES_VIEW` on itself, and every other route — the count, the node, the creation, the edit, the
 * removal, the withdrawal and the restoration — is the CRUD base's own and states none of them. So the
 * list field here carries the route's own pair of guards and its own permission, the class carries the
 * gate, and no other field narrows anything: a permission stated where the route states none would give
 * REST a wider scope than GraphQL for the same route, and this delivery may not narrow REST to match.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('InvoiceEstimateHistory')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class InvoiceEstimateHistoryResolver {
	constructor(private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService) {}

	/**
	 * The log entries of the caller's tenant.
	 */
	@Query('invoiceEstimateHistories')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	async invoiceEstimateHistories(
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
	): Promise<GraphqlConnection<InvoiceEstimateHistory>> {
		// The delivered list route binds `findInput` and `relations` out of its `data` parameter and hands
		// them to the service as the criterion. This surface has no query string to bind, so the read runs
		// with the route's own default for an unstated request — no criterion, no relations — and the
		// connection protocol's `filter` is applied to the rows the service returns. The tenant is applied
		// to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<InvoiceEstimateHistory> = await this.invoiceEstimateHistoryService.findAll(
			{ ...(withDeleted ? { withDeleted: true } : {}) }
		);

		return buildConnection<InvoiceEstimateHistory>({
			rows: items ?? [],
			filterable: INVOICE_ESTIMATE_HISTORY_FILTERABLE,
			sortable: INVOICE_ESTIMATE_HISTORY_SORTABLE,
			defaultSort: INVOICE_ESTIMATE_HISTORY_DEFAULT_SORT,
			request: { filter, sort, page, first, last, after, before, limit, offset }
		});
	}

	/**
	 * One log entry, or null when there is none.
	 */
	@Query('invoiceEstimateHistory')
	async invoiceEstimateHistory(
		@Args('id', { type: () => ID }) id: Id
	): Promise<InvoiceEstimateHistory | null> {
		try {
			return await this.invoiceEstimateHistoryService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many log entries the caller's tenant holds.
	 *
	 * The same call the count route makes with the options it is given when its query string states none:
	 * the service is handed an empty criterion and applies the caller's tenant to it.
	 */
	@Query('invoiceEstimateHistoryCount')
	async invoiceEstimateHistoryCount(): Promise<number> {
		return await this.invoiceEstimateHistoryService.countBy({});
	}

	/**
	 * Files a log entry.
	 *
	 * The same service method the route inherited from the CRUD base calls. The tenant is the
	 * credential's and never an argument, which is the statement every write on this platform makes.
	 */
	@Mutation('createInvoiceEstimateHistory')
	async createInvoiceEstimateHistory(
		@Args('input') input: ICreateInvoiceEstimateHistoryInput
	): Promise<InvoiceEstimateHistory> {
		return await this.invoiceEstimateHistoryService.create(input as unknown as InvoiceEstimateHistory);
	}

	/**
	 * Changes a log entry that exists.
	 *
	 * The delivered edit hands the store the identifier from its path and the body beside it, and a member
	 * the caller leaves out is left as it is. The answer is the row the write produced, read back through
	 * the same node read: the delivered route answers the store's own update result, which is a statement
	 * about the write rather than a row.
	 */
	@Mutation('updateInvoiceEstimateHistory')
	async updateInvoiceEstimateHistory(
		@Args('input') input: IUpdateInvoiceEstimateHistoryInput
	): Promise<InvoiceEstimateHistory> {
		const { id, ...values } = input;

		await this.invoiceEstimateHistoryService.update(id, values as QueryDeepPartialEntity<InvoiceEstimateHistory>);

		return await this.invoiceEstimateHistoryService.findOneByIdString(id);
	}

	/**
	 * Removes a log entry outright.
	 */
	@Mutation('deleteInvoiceEstimateHistory')
	async deleteInvoiceEstimateHistory(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.invoiceEstimateHistoryService.delete(id);

		return true;
	}

	/**
	 * Withdraws a log entry without removing it.
	 *
	 * The delivered route is inherited from the CRUD base, which declares no query parameter of its own
	 * and passes the service the option list it bound from the query string, so the field states none
	 * either.
	 */
	@Mutation('softDeleteInvoiceEstimateHistory')
	async softDeleteInvoiceEstimateHistory(
		@Args('id', { type: () => ID }) id: Id
	): Promise<InvoiceEstimateHistory> {
		return await this.invoiceEstimateHistoryService.softRemove(id);
	}

	/**
	 * Puts a withdrawn log entry back.
	 */
	@Mutation('recoverInvoiceEstimateHistory')
	async recoverInvoiceEstimateHistory(
		@Args('id', { type: () => ID }) id: Id
	): Promise<InvoiceEstimateHistory> {
		return await this.invoiceEstimateHistoryService.softRecover(id);
	}
}
