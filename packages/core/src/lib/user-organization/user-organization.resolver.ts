import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { UserOrganization } from './user-organization.entity';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationDeleteCommand } from './commands';

/** The members `CreateUserOrganizationInput` declares in the schema. */
export interface ICreateUserOrganizationInput {
	organizationId: Id;
	userId: Id;
	isDefault?: boolean;
	isActive?: boolean;
}

/** The members `UpdateUserOrganizationInput` declares in the schema. */
export interface IUpdateUserOrganizationInput {
	id: Id;
	isDefault?: boolean;
	isActive?: boolean;
}

/**
 * The fields a membership list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `UserOrganizationFilter` and
 * `UserOrganizationSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * The two relation members the type does not carry have no entry here either. `user` and `organization`
 * are rows the delivered read answers only when its caller names them, and this surface's read names
 * none — so a filter written against one of their columns would be evaluated against rows that carry
 * neither and would select nothing at all, which is the worst answer a filter can give.
 */
const USER_ORGANIZATION_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	userId: 'ID',
	isDefault: 'BOOLEAN',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const USER_ORGANIZATION_SORTABLE = ['createdAt', 'updatedAt', 'isDefault'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read declares no order of its own and the store answers in its own, so this is
 * not a reproduction of the route's order — there is none to reproduce — but the order that makes a
 * cursor walk total: newest first, which for a membership is the most recently granted access, with
 * the identifier as the last key so that two rows written in the same millisecond still have one order
 * between them.
 */
const USER_ORGANIZATION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The membership over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `UserOrganizationService` method the
 * `/api/user-organization` routes reach, or dispatches the same command.
 *
 * **The guard is the controller's guard, and no permission is stated anywhere.** The delivered
 * controller carries `TenantPermissionGuard` on the class and declares no `@Permissions` — not on its
 * own three routes and not on any route it inherits from the CRUD base — so every route it serves is
 * tenant-guarded and otherwise unpermissioned. A resolver that demanded a permission here would refuse
 * a caller the REST route serves, which is exactly the asymmetry the two-protocol rule forbids;
 * tightening the resource is a change to make in both places at once, and it is not this delivery's
 * to make.
 *
 * **No relation is a field of the type, and the delivered controller's own sensitivity policy is why
 * that is safe rather than merely narrow.** The REST list route runs an interceptor that strips an
 * organization relation's classified members for a caller who does not hold the permission each one is
 * gated by; this surface joins no relation, so there is nothing for a second filter to disagree with.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('UserOrganization')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class UserOrganizationResolver {
	constructor(
		private readonly userOrganizationService: UserOrganizationService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The memberships of the caller's tenant, newest first.
	 */
	@Query('userOrganizations')
	async userOrganizations(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<UserOrganization>> {
		// The delivered list route hands the service the query DTO its query string carries, and the
		// `includeEmployee` flag beside it. This surface has no query string to bind, so the read runs
		// with the route's own defaults — no `where` and no `relations` — and the flag is false, which
		// is what a REST caller that states none gets: the employee the flag attaches is a member this
		// surface's type does not carry and this schema has no `Employee` type to answer with.
		const options = {} as BaseQueryDTO<UserOrganization>;
		const { items }: IPagination<UserOrganization> = await this.userOrganizationService.findUserOrganizations(
			options,
			false
		);

		return buildConnection<UserOrganization>({
			rows: items ?? [],
			filterable: USER_ORGANIZATION_FILTERABLE,
			sortable: USER_ORGANIZATION_SORTABLE,
			defaultSort: USER_ORGANIZATION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One membership of the caller's tenant.
	 *
	 * A membership that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 *
	 * The delivered route joins the relations its `data` parameter names and none otherwise, so the
	 * field asks the same read for no relations — which is what a REST caller that names none gets.
	 */
	@Query('userOrganization')
	async userOrganization(@Args('id', { type: () => ID }) id: Id): Promise<UserOrganization | null> {
		try {
			return await this.userOrganizationService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many memberships the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('userOrganizationCount')
	async userOrganizationCount(): Promise<number> {
		return await this.userOrganizationService.countBy();
	}

	/**
	 * How many organizations the person of one membership belongs to.
	 *
	 * The same two calls the delivered route makes, in the same order: the membership is read by the
	 * identifier the route takes, and the account it names is then counted against the live,
	 * unarchived memberships it holds. The tenant is applied to both by the service, from the
	 * credential.
	 *
	 * A membership that is not there raises rather than counting nothing, which is the delivered
	 * behaviour carried through rather than a zero invented here.
	 */
	@Query('userOrganizationOrganizationsCount')
	async userOrganizationOrganizationsCount(
		@Args('userOrganizationId', { type: () => ID }) userOrganizationId: Id
	): Promise<number> {
		const { userId } = await this.userOrganizationService.findOneByIdString(userOrganizationId);

		return await this.userOrganizationService.count({
			where: { userId, isActive: true, isArchived: false }
		});
	}

	/**
	 * Puts a person inside an organization.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states which person and which organization the
	 * membership joins and never which tenant it is written into.
	 */
	@Mutation('createUserOrganization')
	async createUserOrganization(@Args('input') input: ICreateUserOrganizationInput): Promise<UserOrganization> {
		return await this.userOrganizationService.create(input as unknown as UserOrganization);
	}

	/**
	 * Changes the flags of a membership that exists.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries only what changes. A member the caller
	 * leaves out is left as it is, because the delivered edit is a partial column update rather than a
	 * replacement of the row.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is
	 * not a row and not what a GraphQL field named `updateUserOrganization` may return.
	 */
	@Mutation('updateUserOrganization')
	async updateUserOrganization(@Args('input') input: IUpdateUserOrganizationInput): Promise<UserOrganization> {
		const { id, ...values } = input;

		await this.userOrganizationService.update(id, values as unknown as QueryDeepPartialEntity<UserOrganization>);

		return await this.userOrganizationService.findOneByIdString(id);
	}

	/**
	 * Removes a person from an organization.
	 *
	 * The same command the REST route dispatches, so the two surfaces decide the same way: the handler
	 * removes the person outright when this was their last membership, keeps the platform's own default
	 * accounts, and reserves removing a super administrator for a super administrator. None of that is
	 * restated here — a second copy of the rule is a second rule.
	 *
	 * The answer is whether the removal happened rather than the removed row, because there is no one
	 * row to answer with: the handler's outcome is either a membership or an account.
	 */
	@Mutation('deleteUserOrganization')
	async deleteUserOrganization(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commandBus.execute(new UserOrganizationDeleteCommand(id));

		return true;
	}

	/**
	 * Withdraws a membership: the row is marked rather than removed, and the recovery below reads it
	 * back.
	 *
	 * The delivered route declares no query parameter of its own and passes the service the option
	 * list it bound from the query string, so the field states none either.
	 */
	@Mutation('softDeleteUserOrganization')
	async softDeleteUserOrganization(@Args('id', { type: () => ID }) id: Id): Promise<UserOrganization> {
		return await this.userOrganizationService.softRemove(id);
	}

	/**
	 * Puts a withdrawn membership back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverUserOrganization')
	async recoverUserOrganization(@Args('id', { type: () => ID }) id: Id): Promise<UserOrganization> {
		return await this.userOrganizationService.softRecover(id);
	}
}
