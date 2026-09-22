import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { getFeatureToggleDefinitions } from 'unleash-client';
import { FeatureFlag, Public } from '@gauzy/common';
import { environment } from '@gauzy/config';
import {
	FeatureEnum,
	ID as Id,
	IFeature,
	IFeatureOrganization,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from './graphql-feature.code';
import { FeatureService } from './feature.service';
import { FeatureOrganizationService } from './feature-organization.service';
import { FeatureToggleUpdateCommand } from './commands';

const { unleashConfig } = environment;

/** The members `UpdateFeatureToggleInput` declares in the schema. */
export interface IUpdateFeatureToggleInput {
	featureId: Id;
	isEnabled: boolean;
	organizationId?: Id;
}

/** One toggle definition, as `FeatureToggleDefinition` declares it. */
export interface IFeatureToggleDefinition {
	name: string;
	description?: string;
	type: string;
	project: string;
	enabled: boolean;
	stale: boolean;
	impressionData: boolean;
	strategies: unknown[];
	variants: unknown[];
}

/**
 * The fields a catalogue list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `FeatureFilter` and `FeatureSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `parentId` is filterable because that is how the delivered parent route is expressed here: roots of
 * the catalogue are `parentId: { isNull: true }`, which is the same selection the route performs with
 * its own `where`.
 */
const FEATURE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	description: 'STRING',
	image: 'STRING',
	link: 'STRING',
	status: 'STRING',
	icon: 'STRING',
	isPaid: 'BOOLEAN',
	parentId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the catalogue's sort enum offers. */
const FEATURE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code', 'status'] as const;

/**
 * The order the catalogue is returned in when the caller states none: creation order, oldest first.
 *
 * This is not an invented order. The delivered parent route fixes exactly this order for the same rows
 * — `createdAt` ascending, which is the order the administration UI lists a catalogue in — and a
 * connection whose default disagreed with the one order the delivered reads state would answer the
 * same rows in two different sequences depending on which protocol asked. The identifier is the last
 * key so the order is total, which is what a cursor names a row by.
 */
const FEATURE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The fields a toggle list may be filtered and sorted by.
 *
 * `organizationId` and `featureId` are here because the delivered list route binds exactly those two
 * from its query string; stating them as filter members is what keeps the route's narrowing a filter
 * of the one connection rather than a second root field over the same rows.
 */
const FEATURE_TOGGLE_FILTERABLE = {
	id: 'ID',
	featureId: 'ID',
	isEnabled: 'BOOLEAN',
	tenantId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the toggle list's sort enum offers. */
const FEATURE_TOGGLE_SORTABLE = ['createdAt', 'updatedAt', 'isEnabled'] as const;

/**
 * The order the toggle rows are returned in when the caller states none: newest first.
 *
 * The delivered list method states no order of its own — it hands the store a `where` and takes the
 * rows as they come back — so the order is stated here rather than reproduced from it, and it is
 * stated because a cursor names a row by its position in a total order: without one, a walk over these
 * rows could not resume at all.
 */
const FEATURE_TOGGLE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The feature gate over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `FeatureService`, the same `FeatureOrganizationService`
 * or the same command the `/api/feature/toggle` routes reach.
 *
 * **The guard chain and the permissions are the controller's, read from its metadata and not
 * restated.** `FeatureToggleController` declares `TenantPermissionGuard` and `PermissionGuard` on each
 * of its own routes — not on the class — so each field here carries the same two classes, and each
 * field states the permission its own route states: `ALL_ORG_VIEW` for the three reads and
 * `ALL_ORG_EDIT` for the toggle. The public definition route declares no guard and no permission of
 * its own, so its field declares `@Public()` and neither of those two either.
 *
 * **The gate is the one capability this surface depends on, so it is applied here.** A disabled
 * feature makes its routes answer 404 through `FeatureFlagGuard`, and the catalogue declares
 * `FEATURE_GRAPHQL` as the code that gates the GraphQL endpoint and its resolvers. The guard resolves
 * that code from `FEATURE_METADATA`, read with `getAllAndOverride` over the handler and then the class,
 * which is why the code is declared once on this class: every field below is behind it, and a field
 * that ever needed a different code would state one of its own and the guard would read that instead.
 * Nothing ad-hoc is done here — no call to `isFeatureEnabled` inside a method — because a gate stated
 * in one place and enforced in another is a gate that can be removed from one of them.
 *
 * The effect, stated plainly: a tenant that switched the capability off is answered
 * `Cannot query field <name>` — the same refusal, in this protocol's vocabulary, that a disabled
 * capability's REST routes answer with a 404 — and that includes the toggle mutation below. That is
 * safe rather than circular: `POST /api/feature/toggle` is not gated by this code, so the door that
 * switches a capability back on is never the door the capability locked.
 */
@Resolver('FeatureToggle')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class FeatureToggleResolver {
	constructor(
		private readonly featureService: FeatureService,
		private readonly featureOrganizationService: FeatureOrganizationService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The catalogue of this installation, in creation order.
	 *
	 * The read is the delivered list route's own: `FeatureService.findAll()`, with no `where` and no
	 * relations. The narrowing a caller states arrives in `filter` and is applied to the rows this call
	 * returns, which is the same set the route answers.
	 */
	@Query('features')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	async features(
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
	): Promise<GraphqlConnection<IFeature>> {
		const { items }: IPagination<IFeature> = await this.featureService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<IFeature>({
			rows: items ?? [],
			filterable: FEATURE_FILTERABLE,
			sortable: FEATURE_SORTABLE,
			defaultSort: FEATURE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The caller's tenant's toggle rows, at tenant and organization scope alike.
	 *
	 * The delivered route binds a `tenantId` and an `organizationId` from its query string and hands
	 * them to the service as a `where`; here they are members of `filter`, applied to the rows the same
	 * read returns. The tenant is applied a second time by the service, from the credential, so a
	 * filter that names another tenant narrows to nothing rather than reading across tenants.
	 */
	@Query('featureToggles')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	async featureToggles(
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
	): Promise<GraphqlConnection<IFeatureOrganization>> {
		const { items }: IPagination<IFeatureOrganization> = await this.featureOrganizationService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<IFeatureOrganization>({
			rows: items ?? [],
			filterable: FEATURE_TOGGLE_FILTERABLE,
			sortable: FEATURE_TOGGLE_SORTABLE,
			defaultSort: FEATURE_TOGGLE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The toggle definitions the configured provider declares for the platform's own codes.
	 *
	 * The body is the delivered route's own, verbatim: the definitions are read from the provider only
	 * when one is configured, and the answer is then narrowed to the codes this platform knows, so a
	 * toggle declared for something else is never served as if it were a capability here.
	 *
	 * `@Public()` mirrors the route, which declares it and no guard: this is the one read of the
	 * resource that asks for no credential and no permission. The class-level gate still applies — see
	 * the class comment — because a capability that is switched off is not served over this door.
	 */
	@Query('featureToggleDefinitions')
	@Public()
	async featureToggleDefinitions(): Promise<IFeatureToggleDefinition[]> {
		let featureToggles: IFeatureToggleDefinition[] = [];

		// Load the toggle definitions from the provider if it is enabled.
		if (unleashConfig.url) {
			featureToggles = getFeatureToggleDefinitions();

			// Only the platform's own features are supported; anything else the provider holds is not
			// a capability of this installation.
			const featureEnums: string[] = Object.values(FeatureEnum);
			if (featureToggles) {
				featureToggles = featureToggles.filter((toggle) => featureEnums.includes(toggle.name));
			}
		}

		return featureToggles;
	}

	/**
	 * Switches a capability on or off for a scope.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload, so
	 * the two surfaces write the same row and both then report success as a boolean. The command is
	 * also what evicts the answers `FeatureFlagGuard` has cached for the scopes it wrote, which is what
	 * makes a switch take effect on the next request rather than when the entry expires.
	 */
	@Mutation('toggleFeature')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async toggleFeature(@Args('input') input: IUpdateFeatureToggleInput): Promise<boolean> {
		return await this.commandBus.execute(new FeatureToggleUpdateCommand(input));
	}
}
