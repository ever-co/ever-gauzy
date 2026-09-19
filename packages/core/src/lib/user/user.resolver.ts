import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ComponentLayoutStyleEnum,
	ID as Id,
	IFindMeUser,
	IPagination,
	IUser,
	IUserCreateInput,
	IUserUiPreferences,
	IUserUiPreferencesUpdateInput,
	LanguagesEnum,
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
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserCreateCommand, UserDeleteCommand } from './commands';
import { FactoryResetService } from './factory-reset/factory-reset.service';

/** The members `CreateUserInput` declares in the schema. */
export interface ICreateUserInput {
	email: string;
	roleId?: Id;
	firstName?: string;
	lastName?: string;
	imageUrl?: string;
	preferredLanguage?: string;
}

/** The members `UpdateUserInput` declares in the schema. */
export interface IUpdateUserInput extends Partial<ICreateUserInput> {
	id: Id;
	hash?: string;
	defaultOrganizationId?: Id;
	defaultTeamId?: Id;
	lastOrganizationId?: Id;
	lastTeamId?: Id;
	imageId?: Id;
	isActive?: boolean;
}

/**
 * The fields a user list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `UserFilter` and `UserSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `name` and `isEmailVerified` are here although neither is a column, because the delivered reader
 * merges both onto the row before this resolver sees it: the name from the two name columns, the flag
 * from the verification stamp. Narrowing an access review by either is a read the merged row answers.
 *
 * The six columns the delivered read excludes — `hash`, `refreshToken`, `code`, `codeExpireAt`,
 * `emailToken` and `emailVerifiedAt` — are in neither list. A filter on one of them would answer which
 * digest a password produced or when a token is still usable, which is the same disclosure the read
 * refuses, asked sideways.
 */
const USER_FILTERABLE = {
	id: 'ID',
	thirdPartyId: 'STRING',
	name: 'STRING',
	firstName: 'STRING',
	lastName: 'STRING',
	email: 'STRING',
	phoneNumber: 'STRING',
	username: 'STRING',
	timeZone: 'STRING',
	timeFormat: 'STRING',
	imageUrl: 'STRING',
	imageId: 'ID',
	preferredLanguage: 'STRING',
	preferredComponentLayout: 'STRING',
	uiPreferences: 'JSON',
	lastLoginAt: 'DATE',
	isEmailVerified: 'BOOLEAN',
	roleId: 'ID',
	defaultTeamId: 'ID',
	lastTeamId: 'ID',
	defaultOrganizationId: 'ID',
	lastOrganizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const USER_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'firstName',
	'lastName',
	'email',
	'username',
	'lastLoginAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a filter and takes the rows
 * as they come back — so the connection applies the platform's own: newest first, with the identifier
 * as the last key so that two accounts filed in the same millisecond still have one order between
 * them, which is what makes a cursor walk over them stable.
 */
const USER_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The account over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `UserService` method the `/api/user` routes reach, or
 * dispatches the same command, under the same guard chain and the same permission.
 *
 * **The guard chain is the controller's, field by field, and the class states none of it.** The
 * delivered controller carries no `@UseGuards` and no `@Permissions` at class level — it states both
 * per route — so the class here carries only the gate, and every field states exactly what its own
 * route states: `TenantPermissionGuard` with `PermissionGuard` and the handler's permission, or the
 * tenant guard alone where that is the whole of the route's scope. `me` states neither, because
 * `GET /me` states neither: the account a caller may read is the one its own credential names, the
 * bootstrap's global authentication guard is what proves it, and a resolver that added a scope the
 * route does not carry would refuse GraphQL callers the REST route serves.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('User')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class UserResolver {
	constructor(
		private readonly userService: UserService,
		private readonly factoryResetService: FactoryResetService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The accounts of the caller's tenant, newest first.
	 */
	@Query('users')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	async users(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<User>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const { items }: IPagination<User> = await this.userService.findAll({});

		return buildConnection<User>({
			rows: items ?? [],
			filterable: USER_FILTERABLE,
			sortable: USER_SORTABLE,
			defaultSort: USER_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One account of the caller's tenant.
	 *
	 * An account that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 *
	 * The delivered route reads the relations its `data` parameter names, filtered through the
	 * controller's own allowlist, and reads none otherwise — which is what a REST caller that names
	 * none gets, and therefore what this field asks for.
	 */
	@Query('user')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	async user(@Args('id', { type: () => ID }) id: Id): Promise<User | null> {
		try {
			return await this.userService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * One account of the caller's tenant, by the address it signs in with.
	 *
	 * A miss is `null` for the same reason the identifier look-up's is, and the delivered read answers
	 * `null` itself rather than refusing, so the two surfaces answer a miss the same way without this
	 * field having to translate one into the other.
	 */
	@Query('userByEmail')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	async userByEmail(@Args('email', { type: () => String }) email: string): Promise<IUser | null> {
		return await this.userService.getUserByEmail(email);
	}

	/**
	 * The account the caller's own credential names.
	 *
	 * Unpermissioned and tenant-unguarded, because the delivered route is: the credential is the scope,
	 * and there is nobody else's row for a caller to name. The options the delivered route binds are
	 * left empty — its `relations`, `includeEmployee` and `includeOrganization` parameters select
	 * members this surface's type does not carry, and an argument whose effect is invisible is worse
	 * than an argument that is absent.
	 */
	@Query('me')
	async me(): Promise<IUser> {
		return await this.userService.findMeUser({} as IFindMeUser);
	}

	/**
	 * How many accounts the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('userCount')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_VIEW)
	async userCount(): Promise<number> {
		return await this.userService.countBy();
	}

	/**
	 * Files an account.
	 *
	 * The same command the REST route dispatches, with the payload the delivered body validates. The
	 * tenant is never a member: the service stamps the caller's own tenant and overwrites whatever the
	 * payload states. The role is resolved from the database by the handler rather than trusted from
	 * the body, and granting one the caller may not grant is refused there rather than here.
	 */
	@Mutation('createUser')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	async createUser(@Args('input') input: ICreateUserInput): Promise<IUser> {
		return await this.commandBus.execute(new UserCreateCommand(input as unknown as IUserCreateInput));
	}

	/**
	 * Edits an account that exists.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming an account of another tenant, or one that is not there, is answered with the refusal the
	 * service raises rather than with a write under an identifier it does not own. The identifier is
	 * carried in both places the delivered route carries it — the path and the body — because the
	 * service reads the body's and treats the path's as authoritative.
	 *
	 * `hash` is the one member that is not a column of the answer: the service hashes it before the
	 * write, so the field states a new password and never reads one back.
	 */
	@Mutation('updateUser')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT)
	async updateUser(@Args('input') input: IUpdateUserInput): Promise<IUser> {
		return await this.userService.updateProfile(input.id, { ...input, id: input.id } as unknown as User);
	}

	/**
	 * Writes the caller's own preferred language.
	 *
	 * The account written is the caller's: the delivered route carries no identifier and the service
	 * takes the one the credential names, so a caller cannot point this field at anybody else. The
	 * delivered route answers the store's update result — a statement about the write rather than a row
	 * — so the answer is the caller's own row read back, through the same service the reads call.
	 */
	@Mutation('updatePreferredLanguage')
	@UseGuards(TenantPermissionGuard)
	async updatePreferredLanguage(
		@Args('preferredLanguage', { type: () => String }) preferredLanguage: string
	): Promise<User> {
		await this.userService.updatePreferredLanguage(preferredLanguage as LanguagesEnum);

		return await this.userService.findOneByIdString(RequestContext.currentUserId());
	}

	/**
	 * Writes the caller's own preferred list layout, for the same reason and with the same answer as
	 * the language above.
	 */
	@Mutation('updatePreferredComponentLayout')
	@UseGuards(TenantPermissionGuard)
	async updatePreferredComponentLayout(
		@Args('preferredComponentLayout', { type: () => String }) preferredComponentLayout: string
	): Promise<User> {
		await this.userService.updatePreferredComponentLayout(preferredComponentLayout as ComponentLayoutStyleEnum);

		return await this.userService.findOneByIdString(RequestContext.currentUserId());
	}

	/**
	 * Merges a per-feature patch into the caller's own stored interface preferences.
	 *
	 * The patch is a document keyed by feature, so it arrives as the kernel's `JSON` scalar rather than
	 * as an input object — a free-form map is not a shape an input type can state — and the answer is
	 * the merged document the delivered route answers, which is not a row and is not typed as one.
	 */
	@Mutation('updateUserUiPreferences')
	@UseGuards(TenantPermissionGuard)
	async updateUserUiPreferences(@Args('patch') patch: IUserUiPreferencesUpdateInput): Promise<IUserUiPreferences> {
		return await this.userService.updateUiPreferences(patch);
	}

	/**
	 * Removes an account outright.
	 *
	 * The same command the REST route dispatches, so the two surfaces remove the same set: the service
	 * refuses a caller naming somebody else's account unless it holds the permission that may, and
	 * refuses the platform's own default accounts in a demo environment.
	 */
	@Mutation('deleteUser')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ACCESS_DELETE_ACCOUNT)
	async deleteUser(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commandBus.execute(new UserDeleteCommand(id));

		return true;
	}

	/**
	 * Withdraws an account without removing it.
	 *
	 * No permission is stated because the delivered route states none: the soft removal is inherited
	 * from the CRUD base, where the controller's own guards are the whole of its scope, and this
	 * controller carries none at class level — so the gate on this field is the whole of its scope too.
	 * A resolver that demanded more would refuse a caller the REST route serves.
	 */
	@Mutation('softDeleteUser')
	async softDeleteUser(@Args('id', { type: () => ID }) id: Id): Promise<User> {
		return await this.userService.softRemove(id);
	}

	/**
	 * Puts a withdrawn account back. Unpermissioned for the same reason the withdrawal above is: the
	 * delivered route is inherited and carries no permission to mirror.
	 */
	@Mutation('recoverUser')
	async recoverUser(@Args('id', { type: () => ID }) id: Id): Promise<User> {
		return await this.userService.softRecover(id);
	}

	/**
	 * Erases the caller's data from every table of the tenant.
	 *
	 * The same service the REST route calls, under the same permission and no other: the capability is
	 * the REST surface's, and leaving the field out would make GraphQL the narrower protocol rather
	 * than the safer one. The delivered route answers the organization the caller is left in, which is
	 * a type this schema does not declare, so the field answers whether the reset happened — the fact a
	 * client branches on — and the organization is read from its own surface.
	 */
	@Mutation('factoryReset')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ACCESS_DELETE_ALL_DATA)
	async factoryReset(): Promise<boolean> {
		await this.factoryResetService.reset();

		return true;
	}
}
