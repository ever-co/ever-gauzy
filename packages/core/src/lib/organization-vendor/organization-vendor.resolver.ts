import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { DecimalString, ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationVendor } from './organization-vendor.entity';
import { OrganizationVendorService } from './organization-vendor.service';

/**
 * The members `CreateOrganizationVendorInput` declares in the schema.
 *
 * The delivered creation binds the row itself as its body, so these are the entity's own columns — and
 * the two identifiers the purchasing and tax packages own beside them, which the delivered write stores
 * without their foreign keys.
 */
export interface ICreateOrganizationVendorInput {
	name: string;
	email?: string;
	phone?: string;
	website?: string;
	code?: string;
	currency?: string;
	paymentTermsDays?: number;
	paymentTermId?: Id;
	leadTimeDays?: number;
	minimumOrderAmount?: DecimalString;
	contactId?: Id;
	taxRegimeId?: Id;
	metadata?: Record<string, unknown>;
	organizationId?: Id;
}

/**
 * The members `UpdateOrganizationVendorInput` declares in the schema.
 *
 * The delivered edit is reached through the same write the creation is — the route spreads the body
 * beside the path identifier and calls it — so this input declares the same members the creation does,
 * with the identifier the path carries among them.
 */
export interface IUpdateOrganizationVendorInput extends ICreateOrganizationVendorInput {
	id: Id;
}

/**
 * The fields a supplier list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationVendorFilter` and
 * `OrganizationVendorSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * The purchase orders and the expenses a supplier stands behind are in neither, and for the same reason:
 * neither collection is joined by any read behind this surface, so a condition on it could only ever
 * select the empty set. `deletedAt` is absent because the delivered list read answers live rows only,
 * and the tenant and the organization are absent because both are applied to the criterion from the
 * credential rather than from the caller. The minimum order amount is `DECIMAL` because it is money: a
 * minimum compared as a floating-point number is a minimum that admits the wrong orders.
 */
const ORGANIZATION_VENDOR_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	email: 'STRING',
	phone: 'STRING',
	website: 'STRING',
	code: 'STRING',
	currency: 'STRING',
	paymentTermsDays: 'NUMBER',
	paymentTermId: 'ID',
	leadTimeDays: 'NUMBER',
	minimumOrderAmount: 'DECIMAL',
	contactId: 'ID',
	taxRegimeId: 'ID',
	metadata: 'JSON',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_VENDOR_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own beyond the `order` its `data` parameter carries,
 * so this is a decision the connection has to make rather than one it reproduces. The name is what a
 * supplier master is scanned by, so the suppliers stand in it; the identifier follows, because two
 * suppliers may be recorded under one name and the last key is what makes the order total and a cursor
 * walk over it stable.
 */
const ORGANIZATION_VENDOR_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The suppliers an expense is recorded against, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `OrganizationVendorService` method the `/api/organization-vendors`
 * route behind it does, with the same payload and the same request facts. The supplier master is the row
 * an expense names as the party it was paid to, which is why it belongs to this group of surfaces: the
 * expense book and this master are read together, and a write here is what the expense form's own
 * supplier selector offers.
 *
 * **The guard chain is the controller's and the permission is the absence the controller states.** The
 * controller carries `TenantPermissionGuard` on the class and no `@Permissions` anywhere — on the class
 * or on any handler — so the class here carries that guard beside the gate and every field states no
 * permission at all. A field that demanded one would refuse a caller the REST route serves, which is the
 * narrowing this delivery exists to prevent. The `PermissionGuard` is deliberately absent too: the
 * controller does not carry it, so a permission stated here would never be read.
 *
 * **The removal is the master's own rule and not a plain delete.** The route calls the service's own
 * `deleteVendor`, which refuses a supplier an expense already names rather than orphaning the expense
 * row, so the field calls that same method: a resolver that reached for the store's delete would remove a
 * supplier the REST route protects.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's own guard, so a caller with no credential is
 * refused as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, imported rather than restated because a literal that drifted from the catalogue
 * would name a code no catalogue row carries, which the guard resolves as disabled.
 *
 * This resolver is declared by `OrganizationVendorModule`, beside the service it calls, so the GraphQL
 * host can scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('OrganizationVendor')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationVendorResolver {
	constructor(private readonly organizationVendorService: OrganizationVendorService) {}

	/**
	 * The suppliers of the caller's tenant, in the master's own name order.
	 *
	 * The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
	 * question, so the surface states it once. The `relations` and the `order` the first route reads out
	 * of its `data` parameter are not stated: the row type below declares no relation, and the caller's
	 * own order arrives in the connection's `sort`.
	 */
	@Query('organizationVendors')
	async organizationVendors(
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
	): Promise<GraphqlConnection<OrganizationVendor>> {
		// The reader takes the same service method the list route calls. That route binds its `data`
		// parameter to a criterion, a relation list and an order; this surface has no query string to bind,
		// so the read runs with the route's own defaults and the connection protocol's `filter` narrows the
		// rows the service returns.
		const filterOptions = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<OrganizationVendor>;
		const { items }: IPagination<OrganizationVendor> =
			await this.organizationVendorService.findAll(filterOptions);

		return buildConnection<OrganizationVendor>({
			rows: items ?? [],
			filterable: ORGANIZATION_VENDOR_FILTERABLE,
			sortable: ORGANIZATION_VENDOR_SORTABLE,
			defaultSort: ORGANIZATION_VENDOR_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One supplier of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the other
	 * protocol's vocabulary.
	 */
	@Query('organizationVendor')
	async organizationVendor(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationVendor | null> {
		try {
			return await this.organizationVendorService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many suppliers the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument of
	 * that shape, so the field states no narrowing of its own. The tenant is applied to the criterion by
	 * the service, from the credential rather than from the caller.
	 */
	@Query('organizationVendorCount')
	async organizationVendorCount(): Promise<number> {
		return await this.organizationVendorService.countBy();
	}

	/**
	 * Records a supplier.
	 *
	 * The same service method the inherited creation route calls, with the row the caller states. The
	 * tenant is stamped by the service from the credential and refuses a row that belongs to another one,
	 * so it is not a member the caller can choose freely; the minimum order amount is the exact decimal the
	 * column stores.
	 */
	@Mutation('createOrganizationVendor')
	async createOrganizationVendor(
		@Args('input') input: ICreateOrganizationVendorInput
	): Promise<OrganizationVendor> {
		return await this.organizationVendorService.create(input as unknown as OrganizationVendor);
	}

	/**
	 * Changes a supplier that exists.
	 *
	 * The delivered edit reaches the same write the creation does, carrying the identifier in the path and
	 * the body beside it — which is what the route does before it calls the service — so the field states
	 * one identifier and leaves neither reading undefined, and a member the caller omits is left as it is.
	 */
	@Mutation('updateOrganizationVendor')
	async updateOrganizationVendor(
		@Args('input') input: IUpdateOrganizationVendorInput
	): Promise<OrganizationVendor> {
		const { id, ...values } = input;

		return await this.organizationVendorService.create({
			...values,
			id
		} as unknown as OrganizationVendor);
	}

	/**
	 * Removes a supplier, unless an expense already names it.
	 *
	 * The same service method the inherited removal route calls — the master's own `deleteVendor`, which
	 * counts the rows that point at the supplier and refuses the removal with a bad request when any does.
	 * That refusal is the point of the field: a supplier the expense book depends on is not removable, and
	 * a resolver that reached for the store's own delete would remove a row the REST route protects. The
	 * field answers the one fact the removal establishes, because the delivered store's delete result is
	 * not a row.
	 */
	@Mutation('deleteOrganizationVendor')
	async deleteOrganizationVendor(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationVendorService.deleteVendor(id);

		return true;
	}

	/**
	 * Withdraws a supplier without removing the row.
	 *
	 * No permission is stated on the field, and none could be: the delivered route states none of its own
	 * — the withdrawal is inherited from the CRUD base — and the controller states none on the class
	 * either.
	 */
	@Mutation('softDeleteOrganizationVendor')
	async softDeleteOrganizationVendor(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationVendor> {
		return await this.organizationVendorService.softRemove(id);
	}

	/**
	 * Puts a withdrawn supplier back. Unpermissioned for the same reason the withdrawal above is: the
	 * delivered route is inherited and carries no permission to mirror.
	 */
	@Mutation('recoverOrganizationVendor')
	async recoverOrganizationVendor(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationVendor> {
		return await this.organizationVendorService.softRecover(id);
	}
}
