import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';

/** The members `CreateOrganizationDocumentInput` declares in the schema. */
export interface ICreateOrganizationDocumentInput {
	organizationId: Id;
	name: string;
	documentUrl?: string;
	documentId?: Id;
}

/** The members `UpdateOrganizationDocumentInput` declares in the schema. */
export interface IUpdateOrganizationDocumentInput {
	id: Id;
	organizationId?: Id;
	name?: string;
	documentUrl?: string;
	documentId?: Id;
}

/**
 * The fields a document list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationDocumentFilter` and
 * `OrganizationDocumentSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * The asset's own members are in neither. `document` is eager, so the relation is present on every row
 * — but its members belong to the asset domain's query schema, and a document list narrowed by the
 * bytes behind the file is a question that surface answers. The identifier is here, which is what a
 * caller who already knows the asset actually names.
 */
const ORGANIZATION_DOCUMENT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	documentUrl: 'STRING',
	documentId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_DOCUMENT_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is not a reproduction of the route's order but the order that makes
 * a cursor walk total: newest first, with the identifier as the last key so that two rows written in
 * the same millisecond still have one order between them.
 */
const ORGANIZATION_DOCUMENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization document over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OrganizationDocumentService` method the
 * `/api/organization-documents` routes call — including the four writes and the two lifecycle moves
 * whose routes the controller inherits from the CRUD base rather than declaring.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` anywhere, so
 * every one of its routes is tenant-guarded and otherwise unpermissioned. A resolver that demanded a
 * permission here would refuse a caller the REST route serves, which is exactly the asymmetry the
 * two-protocol rule forbids.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationDocument')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationDocumentResolver {
	constructor(private readonly organizationDocumentService: OrganizationDocumentService) {}

	/**
	 * The documents of the caller's tenant.
	 */
	@Query('organizationDocuments')
	async organizationDocuments(
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
	): Promise<GraphqlConnection<OrganizationDocument>> {
		// The delivered list route binds `findInput` out of its `data` query parameter and hands it to
		// the service as the criterion. This surface has no query string to bind, so the read runs with
		// the route's own default for an unstated request — no criterion, no relations — and the
		// connection protocol's `filter` is applied to the rows the service returns. The tenant is
		// applied to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<OrganizationDocument> = await this.organizationDocumentService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<OrganizationDocument>({
			rows: items ?? [],
			filterable: ORGANIZATION_DOCUMENT_FILTERABLE,
			sortable: ORGANIZATION_DOCUMENT_SORTABLE,
			defaultSort: ORGANIZATION_DOCUMENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One document of the caller's tenant.
	 *
	 * A document that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('organizationDocument')
	async organizationDocument(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationDocument | null> {
		try {
			return await this.organizationDocumentService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many documents the caller's tenant keeps.
	 */
	@Query('organizationDocumentCount')
	async organizationDocumentCount(): Promise<number> {
		return await this.organizationDocumentService.countBy();
	}

	/**
	 * Files a document.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states which organization the row is filed under
	 * and never which tenant it is written into.
	 */
	@Mutation('createOrganizationDocument')
	async createOrganizationDocument(
		@Args('input') input: ICreateOrganizationDocumentInput
	): Promise<OrganizationDocument> {
		return await this.organizationDocumentService.create(input as unknown as OrganizationDocument);
	}

	/**
	 * Changes the facts of a document.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries only what changes. The service is the one the
	 * REST route calls, and it reads the row before it writes, so a document of another tenant, or one
	 * that is not there, is answered with the miss rather than with a write under an identifier the
	 * caller does not own.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateOrganizationDocument` may return.
	 */
	@Mutation('updateOrganizationDocument')
	async updateOrganizationDocument(
		@Args('input') input: IUpdateOrganizationDocumentInput
	): Promise<OrganizationDocument> {
		const { id, ...values } = input;

		await this.organizationDocumentService.update(
			id,
			values as unknown as QueryDeepPartialEntity<OrganizationDocument>
		);

		return await this.organizationDocumentService.findOneByIdString(id);
	}

	/**
	 * Removes a document outright, leaving the asset it points at where it is.
	 */
	@Mutation('deleteOrganizationDocument')
	async deleteOrganizationDocument(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationDocumentService.delete(id);

		return true;
	}

	/**
	 * Withdraws a document: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteOrganizationDocument')
	async softDeleteOrganizationDocument(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationDocument> {
		return await this.organizationDocumentService.softRemove(id);
	}

	/**
	 * Puts a withdrawn document back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganizationDocument')
	async recoverOrganizationDocument(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationDocument> {
		return await this.organizationDocumentService.softRecover(id);
	}
}
