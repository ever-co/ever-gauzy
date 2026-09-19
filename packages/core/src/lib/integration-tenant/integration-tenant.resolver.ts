import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IIntegrationTenant,
	IIntegrationTenantCreateInput,
	IIntegrationTenantFindInput,
	IIntegrationTenantUpdateInput,
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
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenantDeleteCommand, IntegrationTenantUpdateCommand } from './commands';

/** One credential as `CreateIntegrationTenantInput` declares it. */
export interface IIntegrationSettingInput {
	settingsName: string;
	settingsValue: string;
}

/** The members `CreateIntegrationTenantInput` declares in the schema. */
export interface ICreateIntegrationTenantInput {
	name: string;
	integrationId?: Id;
	organizationId?: Id;
	settings?: IIntegrationSettingInput[];
	entitySettings?: unknown[];
}

/** The members `UpdateIntegrationTenantInput` declares in the schema. */
export interface IUpdateIntegrationTenantInput {
	id: Id;
	organizationId?: Id;
	isActive?: boolean;
	isArchived?: boolean;
	settings?: IIntegrationSettingInput[];
}

/**
 * The fields a connection list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `IntegrationTenantFilter` and
 * `IntegrationTenantSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly. `name` is the provider the connection is for, which is what a caller narrows
 * this list by in practice; `lastSyncedAt` is here because "never synchronised" is a question only that
 * column can answer.
 */
const INTEGRATION_TENANT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	integrationId: 'ID',
	lastSyncedAt: 'DATE',
	organizationId: 'ID',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INTEGRATION_TENANT_SORTABLE = ['createdAt', 'updatedAt', 'name', 'lastSyncedAt'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method fixes no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, because a connection is read right after it is made, and then the
 * identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const INTEGRATION_TENANT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The integrations a tenant has connected over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `IntegrationTenantService` method, or dispatches the same
 * command, that the `/api/integration-tenant` routes reach, with the same input.
 *
 * **The permission is stated per field, and that is the parity rather than a deviation.** The
 * controller carries `INTEGRATION_ADD` and `INTEGRATION_EDIT` on the class and states `INTEGRATION_VIEW`
 * on its three reads, `INTEGRATION_EDIT` on the edit and `INTEGRATION_DELETE` on the removal; the
 * inherited routes state nothing of their own, so they run under the class-level pair. One class-level
 * statement here could not be all four, so each field states exactly what its own route's metadata
 * resolves to, and the spec reads those values rather than restating a list.
 *
 * **The count takes no argument**, and that is a statement rather than an omission: the delivered count
 * route passes its query string through as the store's own criterion, which the connection protocol
 * does not speak. What it answers is the count of the caller's own rows, which is the call the route
 * makes when it is given no options — and it is nullable because a count is an aggregate a resource may
 * legitimately have no answer for, while `totalCount` on the connection is the number the filters
 * selected.
 *
 * **The removal carries the organization the delivered route requires.** `DELETE /:id` on this
 * controller is not the CRUD base's removal: it refuses a call that states no organization, reads the
 * row with that scope to publish the platform event a provider's cleanup listens for, and then deletes
 * under the same scope. The field states the same requirement, so a caller cannot reach a removal REST
 * would refuse — and it answers the fact of the removal, which is the one member of the store's
 * deletion result a caller reads.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('IntegrationTenant')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class IntegrationTenantResolver {
	constructor(
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The connections of the caller's tenant, in the resource's own selection.
	 *
	 * The read is the service's list method — the one route `GET /` reaches and the one the paginated
	 * spelling slices — so the criterion that makes a row a connection is applied by the service rather
	 * than restated here. The page a caller states is what the connection performs, so what is read is
	 * the unsliced set the route reads.
	 */
	@Query('integrationTenants')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async integrationTenants(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IntegrationTenant>> {
		const { items }: IPagination<IntegrationTenant> = await this.integrationTenantService.findAll(
			{} as never
		);

		return buildConnection<IntegrationTenant>({
			rows: items ?? [],
			filterable: INTEGRATION_TENANT_FILTERABLE,
			sortable: INTEGRATION_TENANT_SORTABLE,
			defaultSort: INTEGRATION_TENANT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One connection of the caller's tenant.
	 *
	 * The read is the delivered node route's own, relations included: the route binds the `relations`
	 * query parameter and forwards it to the service, so the argument here is the same request stated
	 * in this protocol. A connection that is not there — or that belongs to another tenant — answers
	 * `null` rather than a refusal, because GraphQL has one answer for "no such row" on a field that may
	 * have none.
	 */
	@Query('integrationTenant')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async integrationTenant(
		@Args('id', { type: () => ID }) id: Id,
		@Args('relations', { type: () => [String], nullable: true }) relations?: string[]
	): Promise<IntegrationTenant | null> {
		try {
			return await this.integrationTenantService.findOneByIdString(id, { relations } as never);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many connections the caller's tenant holds.
	 *
	 * The same call the count route makes with the options it is given when its query string states
	 * none.
	 */
	@Query('integrationTenantCount')
	@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	async integrationTenantCount(): Promise<number> {
		return await this.integrationTenantService.countBy();
	}

	/**
	 * The connection for one provider and organization, or null when there is none.
	 *
	 * The service is the delivered route's own, with the same input the route binds: the provider, the
	 * organization and the relations to load. That service answers `false` — for a miss, and equally for
	 * a failure, because it catches its own and answers the same thing — so the field answers `null` for
	 * that one answer, which is this protocol's vocabulary for a row that is not there. It does not
	 * distinguish the two cases, because the delivered service does not.
	 */
	@Query('integrationTenantByOptions')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async integrationTenantByOptions(
		@Args('name', { type: () => String, nullable: true }) name?: string,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id,
		@Args('relations', { type: () => [String], nullable: true }) relations?: string[]
	): Promise<IntegrationTenant | null> {
		const input = { name, organizationId, relations } as unknown as IIntegrationTenantFindInput;
		const resolved = await this.integrationTenantService.getIntegrationByOptions(input);

		return resolved ? (resolved as IntegrationTenant) : null;
	}

	/**
	 * Connects an integration.
	 *
	 * The service is the route's own, and so is the shape of the write: the delivered creation stamps
	 * the caller's tenant onto the row and the credentials and decisions it carries, so a body cannot
	 * name another tenant. The answer is the row the store produced.
	 */
	@Mutation('createIntegrationTenant')
	@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	async createIntegrationTenant(
		@Args('input') input: ICreateIntegrationTenantInput
	): Promise<IntegrationTenant> {
		return (await this.integrationTenantService.create(
			input as unknown as IIntegrationTenantCreateInput
		)) as IntegrationTenant;
	}

	/**
	 * Changes a connection that exists.
	 *
	 * The command is the route's own and reads the row, writes the columns the caller states and
	 * answers the row read back — a partial column update rather than a replacement, which is what makes
	 * an absent member "leave it as it is".
	 */
	@Mutation('updateIntegrationTenant')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async updateIntegrationTenant(
		@Args('input') input: IUpdateIntegrationTenantInput
	): Promise<IntegrationTenant> {
		return await this.commandBus.execute(
			new IntegrationTenantUpdateCommand(input.id, input as unknown as IIntegrationTenantUpdateInput)
		);
	}

	/**
	 * Removes a connection outright.
	 *
	 * The command is the route's own and takes the same two things: the identifier from the path and the
	 * scope from the query string — the organization is required, as it is on the delivered route, and
	 * the read the handler performs under it is what publishes the platform event a provider's own
	 * cleanup listens for. The delivered route answers with the store's deletion result; the field
	 * answers the fact of the removal.
	 */
	@Mutation('deleteIntegrationTenant')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	async deleteIntegrationTenant(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('tenantId', { type: () => ID, nullable: true }) tenantId?: Id
	): Promise<boolean> {
		await this.commandBus.execute(
			new IntegrationTenantDeleteCommand(id, {
				organizationId,
				tenantId
			} as IIntegrationTenantFindInput)
		);

		return true;
	}

	/**
	 * Withdraws a connection without removing it.
	 *
	 * The delivered route is inherited from the CRUD base, which binds no query parameter of its own, so
	 * the field states none either and passes the service the same absence of options.
	 */
	@Mutation('softDeleteIntegrationTenant')
	@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	async softDeleteIntegrationTenant(@Args('id', { type: () => ID }) id: Id): Promise<IntegrationTenant> {
		return await this.integrationTenantService.softRemove(id);
	}

	/**
	 * Puts a withdrawn connection back.
	 */
	@Mutation('recoverIntegrationTenant')
	@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	async recoverIntegrationTenant(@Args('id', { type: () => ID }) id: Id): Promise<IntegrationTenant> {
		return await this.integrationTenantService.softRecover(id);
	}
}
