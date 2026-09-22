import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IOrganizationCreateInput, IOrganizationUpdateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './commands';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';

/** The members `OrganizationContactDetailInput` declares in the schema. */
export interface IOrganizationContactDetailInput {
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: string;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}

/** The members `CreateOrganizationInput` declares in the schema. */
export interface ICreateOrganizationInput {
	name: string;
	currency: string;
	imageId?: Id;
	standardWorkHoursPerDay?: number;
	upworkOrganizationId?: string;
	upworkOrganizationName?: string;
	defaultValueDateType?: string;
	startWeekOn?: string;
	inviteExpiryPeriod?: number;
	regionCode?: string;
	bonusPercentage?: number;
	bonusType?: string;
	contact?: IOrganizationContactDetailInput;
}

/** The members `UpdateOrganizationInput` declares in the schema. */
export interface IUpdateOrganizationInput extends ICreateOrganizationInput {
	id: Id;
	show_income?: boolean;
	show_profits?: boolean;
	show_bonuses_paid?: boolean;
	show_total_hours?: boolean;
	show_minimum_project_size?: boolean;
	show_projects_count?: boolean;
	show_clients_count?: boolean;
	show_clients?: boolean;
	show_employees_count?: boolean;
}

/**
 * The fields an organization list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationFilter` and `OrganizationSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable
 * in the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * The settings columns are in neither. They are read on one organization at a time — a client reads
 * them to decide what a write into that scope should default to — and a list narrowed by a tracking
 * flag is not a question the organization picker asks. What is here is the identity of an
 * organization and the handful of columns a list of them is chosen by.
 */
const ORGANIZATION_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	currency: 'STRING',
	isDefault: 'BOOLEAN',
	regionCode: 'STRING',
	timeZone: 'STRING',
	officialName: 'STRING',
	taxId: 'STRING',
	website: 'STRING',
	contactId: 'ID',
	bonusType: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_SORTABLE = ['createdAt', 'updatedAt', 'name', 'currency', 'isDefault'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read declares no order of its own — it hands the store the criterion and takes
 * the rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: the name ascending, because a name is how an organization is chosen from a list of
 * them, then the identifier, which is the key that makes the order total and a cursor walk over it
 * stable.
 */
const ORGANIZATION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The organization over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `OrganizationService` method, or dispatches the same
 * command, that the `/api/organization` routes reach.
 *
 * **The guard chain and the permission are the controller's, field by field.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `ALL_ORG_EDIT` on the class,
 * so this resolver carries the same two guards and the same class-level permission, and each field
 * then states the permission its own route runs under. Two of those readings are worth spelling out,
 * because both are cases where the obvious answer is the wrong one:
 *
 * - `organization` — the one-row read — states an **empty** permission. The delivered `GET /:id`
 *   route carries `@Permissions()` with no argument, and the permission guard reads the handler's
 *   declaration before the class's, so that empty declaration overrides the controller's class
 *   permission and the route runs unpermissioned. Stating the edit permission here, or stating
 *   nothing and inheriting it, would both refuse a caller the REST route serves.
 * - the two writes state `ALL_ORG_EDIT`, which is what they resolve to on the route: neither route
 *   declares a permission of its own, so `getAllAndOverride` answers with the class's.
 *
 * **Nothing reaches for the service on the two writes.** Filing an organization is more than an
 * insert — the handler puts the tenant's administrators into it, files the contact row beside it and
 * provisions the organization's report menu, task statuses, sizes, priorities, issue types and task
 * settings — so both fields dispatch the command the delivered route dispatches rather than writing a
 * row the rest of the platform never finished setting up.
 *
 * **No relation is a member of the answer, and the sensitive-relation guard is not restated.** That
 * guard refuses a REST caller that *names* a relation it may not load; it is a refusal on the request
 * rather than a filter on the answer, and this surface has no `relations` argument. The read below
 * therefore names no relation at all — which is what a REST caller that names none gets — and the one
 * relation that always travels, the eager logo asset, is not on the sensitive list.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Organization')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
export class OrganizationResolver {
	constructor(
		private readonly organizationService: OrganizationService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The organizations of the caller's tenant, in name order.
	 */
	@Query('organizations')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	async organizations(
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
	): Promise<GraphqlConnection<Organization>> {
		// The delivered list route binds its query DTO to the query string and hands it to the service:
		// the `where`, the `relations` and the page. This surface has no query string to bind, so the
		// read runs with the route's own defaults for an unstated request — no criterion, no relations,
		// no page — and the connection protocol's `filter` is applied to the rows the service returns.
		// The tenant is applied to the criterion by the service, from the credential rather than from
		// the caller.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Organization>;
		const { items }: IPagination<Organization> = await this.organizationService.findAll(options);

		return buildConnection<Organization>({
			rows: items ?? [],
			filterable: ORGANIZATION_FILTERABLE,
			sortable: ORGANIZATION_SORTABLE,
			defaultSort: ORGANIZATION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One organization of the caller's tenant.
	 *
	 * A organization that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 *
	 * The empty permission is the route's own — see the class comment. It is stated rather than left
	 * off, because leaving it off would inherit the class's edit permission and narrow this field below
	 * the route it mirrors.
	 *
	 * The delivered route joins the relations its `OrganizationFindOptionsQueryDTO` query string names
	 * and none otherwise, so the field asks the same read for the same absence of relations — which is
	 * what a REST caller that names none gets.
	 */
	@Query('organization')
	@Permissions()
	async organization(@Args('id', { type: () => ID }) id: Id): Promise<Organization | null> {
		try {
			return await this.organizationService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many organizations the caller's tenant has.
	 */
	@Query('organizationCount')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW)
	async organizationCount(): Promise<number> {
		return await this.organizationService.countBy();
	}

	/**
	 * Files an organization through the command the delivered route dispatches.
	 *
	 * The payload is the input as stated. The tenant is stamped from the credential by the handler and
	 * is never a member here: there is no way for a caller to file an organization into a tenant it is
	 * not acting in.
	 */
	@Mutation('createOrganization')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async createOrganization(@Args('input') input: ICreateOrganizationInput): Promise<Organization> {
		return await this.commandBus.execute(
			new OrganizationCreateCommand(input as unknown as IOrganizationCreateInput)
		);
	}

	/**
	 * Edits an organization through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries the facts. The handler reads the row before
	 * it writes, so an organization of another tenant, or one that is not there, is answered with the
	 * miss rather than with a write under an identifier the caller does not own.
	 */
	@Mutation('updateOrganization')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async updateOrganization(@Args('input') input: IUpdateOrganizationInput): Promise<Organization> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new OrganizationUpdateCommand(id, values as unknown as IOrganizationUpdateInput)
		);
	}

	/**
	 * Removes an organization outright.
	 */
	@Mutation('deleteOrganization')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async deleteOrganization(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationService.delete(id);

		return true;
	}

	/**
	 * Withdraws an organization: the row is marked rather than removed, and every record filed under it
	 * keeps pointing at it.
	 */
	@Mutation('softDeleteOrganization')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async softDeleteOrganization(@Args('id', { type: () => ID }) id: Id): Promise<Organization> {
		return await this.organizationService.softRemove(id);
	}

	/**
	 * Puts a withdrawn organization back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganization')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async recoverOrganization(@Args('id', { type: () => ID }) id: Id): Promise<Organization> {
		return await this.organizationService.softRecover(id);
	}
}
