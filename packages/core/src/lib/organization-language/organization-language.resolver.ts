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
import { OrganizationLanguage } from './organization-language.entity';
import { OrganizationLanguageService } from './organization-language.service';

/** The members `CreateOrganizationLanguageInput` declares in the schema. */
export interface ICreateOrganizationLanguageInput {
	organizationId: Id;
	languageCode: string;
	name: string;
	level: string;
}

/** The members `UpdateOrganizationLanguageInput` declares in the schema. */
export interface IUpdateOrganizationLanguageInput {
	id: Id;
	organizationId?: Id;
	languageCode?: string;
	name?: string;
	level?: string;
}

/**
 * The fields an organization-language list may be filtered and sorted by, and the order it is returned
 * in when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationLanguageFilter` and
 * `OrganizationLanguageSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * The `language` relation is in neither. It is a row of the platform's language reference table, joined
 * only when a REST caller names it in its query string, and this surface names none — so a filter on it
 * would be evaluated against a row that carries none of it and would select nothing at all. The code
 * is here, which is what a caller who already knows which language it means actually names.
 */
const ORGANIZATION_LANGUAGE_FILTERABLE = {
	id: 'ID',
	languageCode: 'STRING',
	name: 'STRING',
	level: 'STRING',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_LANGUAGE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'languageCode', 'level'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is not a reproduction of the route's order but the order that makes
 * a cursor walk total: newest first, with the identifier as the last key so that two rows written in
 * the same millisecond still have one order between them.
 */
const ORGANIZATION_LANGUAGE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization language over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OrganizationLanguageService` method the
 * `/api/organization-languages` routes call — including the five whose routes the controller inherits
 * from the CRUD base rather than declaring.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` anywhere, so
 * every one of its routes is tenant-guarded and otherwise unpermissioned. A resolver that demanded a
 * permission here would refuse a caller the REST route serves, which is exactly the asymmetry the
 * two-protocol rule forbids.
 *
 * **The language is an identifier rather than a field.** The reference row is joined only when a REST
 * caller names the relation, and this surface names none, so `languageCode` is what is carried and the
 * row behind it is read from the language surface.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationLanguage')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationLanguageResolver {
	constructor(private readonly organizationLanguageService: OrganizationLanguageService) {}

	/**
	 * The language rows of the caller's tenant.
	 */
	@Query('organizationLanguages')
	async organizationLanguages(
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
	): Promise<GraphqlConnection<OrganizationLanguage>> {
		// The delivered list route binds `relations` and `findInput` out of its `data` query parameter
		// and hands them to the service. This surface has no query string to bind, so the read runs with
		// the route's own default for an unstated request — no criterion, no relations — and the
		// connection protocol's `filter` is applied to the rows the service returns. The tenant is
		// applied to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<OrganizationLanguage> = await this.organizationLanguageService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<OrganizationLanguage>({
			rows: items ?? [],
			filterable: ORGANIZATION_LANGUAGE_FILTERABLE,
			sortable: ORGANIZATION_LANGUAGE_SORTABLE,
			defaultSort: ORGANIZATION_LANGUAGE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One language row of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('organizationLanguage')
	async organizationLanguage(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationLanguage | null> {
		try {
			return await this.organizationLanguageService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many language rows the caller's tenant keeps.
	 */
	@Query('organizationLanguageCount')
	async organizationLanguageCount(): Promise<number> {
		return await this.organizationLanguageService.countBy();
	}

	/**
	 * Files a language row.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states which organization the row is filed under
	 * and never which tenant it is written into.
	 */
	@Mutation('createOrganizationLanguage')
	async createOrganizationLanguage(
		@Args('input') input: ICreateOrganizationLanguageInput
	): Promise<OrganizationLanguage> {
		return await this.organizationLanguageService.create(input as unknown as OrganizationLanguage);
	}

	/**
	 * Changes the facts of a language row.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries only what changes. The service is the one the
	 * REST route calls, and it reads the row before it writes, so a row of another tenant, or one that
	 * is not there, is answered with the miss rather than with a write under an identifier the caller
	 * does not own.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateOrganizationLanguage` may return.
	 */
	@Mutation('updateOrganizationLanguage')
	async updateOrganizationLanguage(
		@Args('input') input: IUpdateOrganizationLanguageInput
	): Promise<OrganizationLanguage> {
		const { id, ...values } = input;

		await this.organizationLanguageService.update(
			id,
			values as unknown as QueryDeepPartialEntity<OrganizationLanguage>
		);

		return await this.organizationLanguageService.findOneByIdString(id);
	}

	/**
	 * Removes a language row outright.
	 */
	@Mutation('deleteOrganizationLanguage')
	async deleteOrganizationLanguage(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationLanguageService.delete(id);

		return true;
	}

	/**
	 * Withdraws a language row: the row is marked rather than removed, and the recovery below reads it
	 * back.
	 */
	@Mutation('softDeleteOrganizationLanguage')
	async softDeleteOrganizationLanguage(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationLanguage> {
		return await this.organizationLanguageService.softRemove(id);
	}

	/**
	 * Puts a withdrawn language row back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganizationLanguage')
	async recoverOrganizationLanguage(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationLanguage> {
		return await this.organizationLanguageService.softRecover(id);
	}
}
