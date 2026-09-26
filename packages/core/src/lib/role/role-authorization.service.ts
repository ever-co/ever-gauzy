import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Utils, wrap } from '@mikro-orm/core';
import { ID, IRole, PermissionsEnum } from '@gauzy/contracts';
import { IAuthenticatedUser } from '../core/context/types';
import { getORMType, MultiORM, MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { Role } from './role.entity';
import { MikroOrmRoleRepository } from './repository/mikro-orm-role.repository';
import { TypeOrmRoleRepository } from './repository/type-orm-role.repository';

/**
 * The authorization state of a single role, as it exists in the database RIGHT NOW.
 *
 * `role` is deliberately a lean object (no `rolePermissions` payload) because it is cached and then
 * attached to `request.user`.
 */
export interface IRoleAuthorizationState {
	readonly role: IRole;
	readonly permissions: PermissionsEnum[];
}

/**
 * Resolves the role name and the enabled permissions of a role from the DATABASE.
 *
 * Why this exists: the access token embeds a `role` name and a `permissions` array at issuance time
 * (`AuthService.getJwtAccessToken`). Reading those claims back to make an authorization decision means
 * authorizing against state that can be up to one token lifetime (24h by default) out of date — a user
 * demoted from SUPER_ADMIN kept deleting tenants until their token expired (GHSA-m8xc-8pwr-89fj).
 *
 * `JwtStrategy` therefore calls this once per request, while it is already loading the user, and pins
 * the result onto `request.user`; every `RequestContext.hasRoles/hasPermissions/hasAnyPermission` call
 * during that request then reads the attached state instead of the token. The lookup is keyed on the
 * user's CURRENT `roleId`, so a role change takes effect on the very next request. Only the
 * role -> permission-set mapping is cached (briefly), which is exactly the part that does not change
 * when a user is demoted.
 */
@Injectable()
export class RoleAuthorizationService {
	private readonly ormType: MultiORM = getORMType();
	private readonly logger = new Logger(RoleAuthorizationService.name);

	/** Cache key prefix for the per-role authorization state. */
	private static readonly CACHE_KEY_PREFIX = 'authz_role_state_';

	/**
	 * Kept short on purpose. A demotion is reflected immediately (the key is the user's current
	 * roleId), so this TTL only bounds how long an edit to a ROLE's permission set can linger — and
	 * it is shorter than the 5 minute caches `PermissionGuard` / `TenantPermissionGuard` already use.
	 */
	private static readonly CACHE_TTL_MS = 60 * 1000;

	constructor(
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly mikroOrmRoleRepository: MikroOrmRoleRepository,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache
	) {}

	/**
	 * Loads the current name and enabled permissions of a role.
	 *
	 * @param roleId The role to resolve. A missing id resolves to `null` — fail closed, never to a
	 *               permissive default.
	 * @returns The role's authorization state, or `null` when it cannot be resolved.
	 */
	async getAuthorizationState(roleId: ID): Promise<IRoleAuthorizationState | null> {
		// No role id means no verdict can be reached. Returning null (rather than an empty-but-present
		// state) keeps every caller on the fail-closed path.
		if (!roleId) {
			return null;
		}

		const cacheKey = `${RoleAuthorizationService.CACHE_KEY_PREFIX}${roleId}`;

		try {
			const cached = await this.cacheManager?.get<IRoleAuthorizationState>(cacheKey);

			if (cached) {
				return cached;
			}
		} catch (error) {
			// A cache outage must not take authorization down with it; fall through to the database.
			this.logger.warn(`Could not read the role authorization state from cache: ${error?.message}`);
		}

		const role = await this.findRoleWithPermissions(roleId);

		if (!role) {
			return null;
		}

		const state: IRoleAuthorizationState = {
			role: { id: role.id, name: role.name, tenantId: role.tenantId } as IRole,
			// Same predicate `RolePermissionService.checkRolePermission` applies in SQL, so a permission
			// attached to `request.user` is one `PermissionGuard` would also grant.
			permissions: (role.rolePermissions ?? [])
				.filter((rp) => rp.enabled === true && rp.isActive === true && rp.isArchived === false)
				.map((rp) => rp.permission as PermissionsEnum)
		};

		try {
			await this.cacheManager?.set(cacheKey, state, RoleAuthorizationService.CACHE_TTL_MS);
		} catch (error) {
			this.logger.warn(`Could not cache the role authorization state: ${error?.message}`);
		}

		return state;
	}

	/**
	 * Pins the database-fresh role and permissions of a user onto the object that is about to become
	 * `request.user`.
	 *
	 * When the role cannot be resolved the user is left WITHOUT a role and WITHOUT permissions, so
	 * every subsequent check denies rather than falling back to whatever the token claimed.
	 *
	 * Under MikroORM a user the request's unit of work manages is given the managed role entity instead
	 * of the lean state (see {@link managedRoleOf}); under TypeORM the lean state is pinned as it always was.
	 *
	 * @param user The authenticated user.
	 * @returns The same user instance, with `role` and `permissions` set.
	 */
	async attachAuthorizationState<T extends IAuthenticatedUser>(user: T): Promise<T> {
		if (!user) {
			return user;
		}

		const state = await this.getAuthorizationState(user.roleId);
		const role =
			state && this.ormType === MultiORMEnum.MikroORM ? await this.managedRoleOf(user, state.role) : state?.role;

		if (state && role) {
			user.role = role;
			user.permissions = state.permissions;
		} else {
			// Do not leave behind a role the caller brought with them (an eagerly loaded relation, or a
			// value set earlier in the request): `RequestContext.hasRoles()` reads `user.role`, so a role
			// kept here would still authorize a user whose role no longer resolves.
			//
			// Under MikroORM an unloaded reference is the exception: it is what a managed user's relation holds
			// as loaded, and it names no role (its `name` was never read), so it grants nothing. Removing it is a
			// change of the relation the unit of work tracks: once the request reads the user's row again, as
			// `employeeMembers` reads the caller's, a flush stored the user with no role at all
			// (role-authorization.service.mikro-orm.spec.ts, a role soft-deleted while its state was cached).
			if (this.ormType !== MultiORMEnum.MikroORM || !this.isUnloadedReference(user.role)) {
				delete user.role;
			}
			user.permissions = [];
		}

		return user;
	}

	/**
	 * Whether a value is a MikroORM reference whose row was never loaded, i.e. one that carries its primary key
	 * and nothing else.
	 *
	 * @param value The value of a user's `role`.
	 */
	private isUnloadedReference(value: unknown): boolean {
		return Utils.isEntity(value) && !wrap(value).isInitialized();
	}

	/**
	 * The role to pin onto a user under MikroORM.
	 *
	 * **What failed.** `JwtStrategy` loads the caller through `UserService.getIfExists`, which under
	 * `DB_ORM=mikro-orm` is a `findOne` on the request's own fork: the user on the request is the entity that
	 * fork's unit of work manages, and `role` is one of its many-to-one relations. Pinning the lean, cached
	 * `{ id, name, tenantId }` onto it left a plain object where MikroORM keeps an entity. The next read in the
	 * same request that returned the caller's row again — `employeeMembers` populates the user of every member,
	 * and the caller is one — merged into the managed user, which snapshots it first, and the snapshot of a
	 * to-one relation reads `role.__helper.__identifier`: a plain object has no `__helper`, and the read failed
	 * with "Cannot read properties of undefined (reading '__identifier')".
	 *
	 * **Why this is right.** A managed entity's relation holds the managed entity of the row it references, and
	 * the role the state names is the row the user's own foreign key references, so the unit of work already
	 * holds it as the user's `role`. It is read through that unit of work: when `findRoleWithPermissions` just
	 * loaded it, from the identity map without a query; when the state came from the cache and the role is still
	 * a bare reference, by one primary-key read, so that its `name` — what `RequestContext.currentRoleName()`
	 * reads — is there. The relation ends up holding the value it was loaded with, so a later flush has nothing
	 * to write for it. A user no unit of work manages (a plain object) has no snapshot to break and takes the lean
	 * state, as it does under TypeORM.
	 *
	 * @param user The authenticated user.
	 * @param role The lean role of the resolved authorization state.
	 * @returns The role to pin, or `null` when the unit of work no longer finds the role (it was soft-deleted
	 * while its state was cached), which leaves the user without one, as an unresolved role does.
	 */
	private async managedRoleOf(user: IAuthenticatedUser, role: IRole): Promise<IRole | null> {
		if (!Utils.isEntity(user)) {
			return role;
		}

		const wrapped = wrap(user, true);
		const relation = wrapped.__meta?.properties?.['role'];

		if (!wrapped.__managed || !wrapped.__em || !relation?.targetMeta) {
			return role;
		}

		return (await wrapped.__em.findOne(relation.targetMeta.class, { id: role.id })) as IRole | null;
	}

	/**
	 * Reads the role together with its role permissions, on either ORM.
	 *
	 * @param roleId The role to load.
	 * @returns The role with its `rolePermissions`, or null when it does not exist.
	 */
	private async findRoleWithPermissions(roleId: ID): Promise<Role | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<Role>({
					where: { id: roleId },
					relations: { rolePermissions: true }
				});
				return (await this.mikroOrmRoleRepository.findOne(where, mikroOptions)) as Role;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRoleRepository.findOne({
					where: { id: roleId },
					relations: { rolePermissions: true }
				});
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}
}
