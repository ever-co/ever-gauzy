import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ContactBuyerRole, IContactBuyer, ID as Id, PermissionsEnum } from '@gauzy/contracts';
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
import { ContactBuyerService } from './contact-buyer.service';

/**
 * The members `CreateContactBuyerInput` declares in the schema.
 *
 * Neither side of the pivot is mutable afterwards, so there is no update input: a membership that could
 * be re-pointed at another buyer or another account would be a way to move purchasing authority without
 * a trace, and the supported path is to remove the membership and attach a new one.
 */
export interface ICreateContactBuyerInput {
	organizationId: Id;
	companyCustomerId: Id;
	buyerCustomerId: Id;
	role?: ContactBuyerRole;
	spendingLimit?: number;
	periodSpendingLimit?: number;
	approvalThreshold?: number;
	periodStartDay?: number;
	assignedAt?: Date;
	invitedByUserId?: Id;
	metadata?: Record<string, unknown>;
}

/**
 * The fields a membership list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ContactBuyerFilter` and `ContactBuyerSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 */
const CONTACT_BUYER_FILTERABLE = {
	id: 'ID',
	companyCustomerId: 'ID',
	buyerCustomerId: 'ID',
	role: 'ENUM',
	periodStartDay: 'NUMBER',
	invitedByUserId: 'ID',
	isActive: 'BOOLEAN',
	assignedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CONTACT_BUYER_SORTABLE = [
	'createdAt',
	'updatedAt',
	'assignedAt',
	'role',
	'spendingLimit',
	'periodSpendingLimit',
	'approvalThreshold'
] as const;

/**
 * The order the delivered list method means: newest first. The connection reproduces it rather than
 * replacing it, so the REST answer and this one list the same rows in the same order when neither
 * caller states a sort.
 */
const CONTACT_BUYER_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Company-account membership over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `ContactBuyerService` the `/api/contact-buyers` routes call,
 * under the same guard chain and the same permission.
 *
 * **Buyer authority deliberately does not come from a tenant role.** A buyer is not staff: they have no
 * `user` row in the common case and no business in the back-office permission model, and a tenant-wide
 * role would grant one company's clerk authority visible to every other actor in the tenant. The
 * membership's own `role` and its ceilings are the authority — `resolveAuthority` is where the three
 * answers are separated, and `assertMayPurchase` is where a placement is refused — which is why the
 * `role` below is the pivot's field and not a permission.
 *
 * **The resource has three root fields, and that is the specification's own list.** `contactBuyers`,
 * `createContactBuyer` and `deleteContactBuyer` are what §3.2 row 4 names; there is no node query, and no
 * update, because neither side of the pivot is mutable.
 *
 * **`withDeleted` is deliberately absent.** It is a repository option the delivered list methods do not
 * expose, and offering an argument that cannot be honoured would be worse than not offering it.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ContactBuyer')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
export class ContactBuyerResolver {
	constructor(private readonly contactBuyerService: ContactBuyerService) {}

	/**
	 * The company-account memberships of the caller's organization, newest first.
	 */
	@Query('contactBuyers')
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	async contactBuyers(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IContactBuyer>> {
		const rows = await this.contactBuyerService.listBuyers();

		return buildConnection<IContactBuyer>({
			rows,
			filterable: CONTACT_BUYER_FILTERABLE,
			sortable: CONTACT_BUYER_SORTABLE,
			defaultSort: CONTACT_BUYER_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Attaches a buyer to a company account.
	 */
	@Mutation('createContactBuyer')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async createContactBuyer(@Args('input') input: ICreateContactBuyerInput): Promise<IContactBuyer> {
		return this.contactBuyerService.addBuyer(input as never);
	}

	/**
	 * Removes a membership, softly, which is the only removal path there is.
	 */
	@Mutation('deleteContactBuyer')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async deleteContactBuyer(@Args('id', { type: () => ID }) id: Id): Promise<IContactBuyer> {
		return this.contactBuyerService.removeBuyer(id);
	}
}
