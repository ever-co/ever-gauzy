import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { environment as env } from '@gauzy/config';
import { ID, IRole, IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../core/context';
import { TypeOrmRoleRepository } from '../../role/repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from '../../role/repository/mikro-orm-role.repository';
import { RoleAuthorizationService } from '../../role/role-authorization.service';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from '../../organization/repository/mikro-orm-organization.repository';
import { getORMType, MultiORMEnum } from '../../core/utils';
import { isAccessTokenPayload, JWT_ALGORITHMS } from '../../auth/purpose-token';

/**
 * Minimal user shape set on the request by this guard when the register route
 * is called with privileged fields by an authenticated admin. Ensures
 * RequestContext.currentTenantId() and related helpers are available for the rest of the request.
 */
export interface RegisterRequestUser {
	id: ID;
	tenantId: ID;
	roleId?: ID;
	/** The role the caller holds in the DATABASE, not the one their token claims. */
	role?: IRole;
	/** Enabled permissions of that role, so RequestContext.hasPermission() is answerable downstream. */
	permissions?: PermissionsEnum[];
}

/**
 * List of fields in the register request body that require the caller
 * to be an authenticated ADMIN or SUPER_ADMIN.
 *
 * If the request body contains NONE of these fields, the guard allows
 * the request through (pure public self-registration).
 *
 * If ANY of these fields are present, the guard verifies:
 *  1. A valid JWT is attached to the request
 *  2. The account it names is still active, and is ADMIN or SUPER_ADMIN according to the DATABASE
 *  3. If a roleId is provided, it belongs to the caller's tenant
 *  4. If an organizationId is provided, it belongs to the caller's tenant
 *  5. createdByUserId is overridden with the authenticated caller's ID
 */
const PRIVILEGED_FIELDS: string[] = ['roleId', 'organizationId', 'createdByUserId', 'featureAsEmployee'];

/**
 * Privileged fields that may appear nested inside `body.user`.
 */
const PRIVILEGED_USER_FIELDS: string[] = ['role', 'roleId', 'tenant', 'tenantId'];

/**
 * Extracts id from a relation field (object with id) or returns undefined.
 *
 * @param rel The relation field to extract the id from.
 * @returns The id of the relation field or undefined if the relation field is not an object with an id property.
 */
function getIdFromRelation(rel: unknown): string | undefined {
	if (rel == null || typeof rel !== 'object' || !('id' in rel)) return undefined;
	const id = (rel as { id: unknown }).id;
	return typeof id === 'string' ? id : undefined;
}

/**
 * Guard that protects the public registration endpoint
 *
 * The `/api/auth/register` endpoint is @Public() (no global AuthGuard).
 * This guard inspects the request body:
 *  - If no privileged fields are present → pure public registration → allow through.
 *  - If privileged fields are present → require a valid JWT whose user is, in the database, an
 *    active ADMIN/SUPER_ADMIN, and verify tenant isolation for any supplied roleId or organizationId.
 */
@Injectable()
export class RegisterAuthorizationGuard implements CanActivate {
	constructor(
		private readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		private readonly mikroOrmRoleRepository: MikroOrmRoleRepository,
		private readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		private readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository,
		private readonly roleAuthorizationService: RoleAuthorizationService,
		private readonly moduleRef: ModuleRef
	) {}

	/**
	 * Loads the caller named by the token from the database.
	 *
	 * The user repository is resolved when the guard RUNS, not when this file is loaded. This file sits
	 * on the User entity's own module-initialization chain — `user.entity` -> `core/entities/internal`
	 * -> `import-history.subscriber` -> `core/file-storage` -> `tenant-setting.module` ->
	 * `role-permission.module` -> `role-permission.controller` -> `shared/guards` -> here — so a
	 * top-level import of anything under `user/` closes that cycle: the user repository is then
	 * evaluated while `user.entity` is still being initialized, `@InjectRepository(User)` receives
	 * `undefined`, and Nest fails with "A circular dependency has been detected inside
	 * @InjectRepository()". Deferring the import keeps the cycle open.
	 *
	 * @param id The user id carried by the token.
	 * @returns The user row, or null when it does not exist.
	 */
	private async findCaller(id: ID): Promise<IUser | null> {
		// Never look a user up by an empty id: TypeORM drops an `undefined` where value, so
		// `findOne({ where: { id: undefined } })` returns the FIRST row in the table.
		if (!id) {
			return null;
		}

		if (getORMType() === MultiORMEnum.MikroORM) {
			const { MikroOrmUserRepository } = await import('../../user/repository/mikro-orm-user.repository');
			const repository = this.moduleRef.get(MikroOrmUserRepository, { strict: false });
			return (await repository.findOne({ id })) as IUser;
		}

		const { TypeOrmUserRepository } = await import('../../user/repository/type-orm-user.repository');
		const repository = this.moduleRef.get(TypeOrmUserRepository, { strict: false });
		return await repository.findOne({ where: { id } });
	}

	/**
	 * Checks if the request is authorized to proceed.
	 *
	 * @param context The execution context.
	 * @returns A promise that resolves to a boolean indicating whether the request is authorized.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const body = request.body || {};
		const userPayload = body.user || {};

		// Check if any privileged fields are present in the request body
		const hasPrivilegedTopLevel = PRIVILEGED_FIELDS.some(
			(field) => body[field] !== undefined && body[field] !== null
		);

		// Check if any privileged fields are present in the user payload
		const hasPrivilegedUser = PRIVILEGED_USER_FIELDS.some(
			(field) => userPayload[field] !== undefined && userPayload[field] !== null
		);

		// If no privileged fields → pure public self-registration → allow through
		if (!hasPrivilegedTopLevel && !hasPrivilegedUser) {
			return true;
		}

		// --- Privileged fields detected: require authenticated ADMIN/SUPER_ADMIN ---

		// Extract the JWT token from the Authorization header
		const token = RequestContext.currentToken();
		if (!token) {
			throw new ForbiddenException(
				'Authentication required: privileged registration fields (role, tenant, organization) ' +
					'can only be used by authenticated administrators.'
			);
		}

		// Verify the JWT and extract the caller's identity. Only `id` is taken from the token: the
		// `role` and `tenantId` claims are resolved from the database below instead.
		let jwtPayload: { id: string };
		try {
			jwtPayload = verify(token, env.JWT_SECRET, { algorithms: JWT_ALGORITHMS }) as any;
		} catch {
			throw new ForbiddenException('Invalid or expired authentication token.');
		}

		// Only an ACCESS token authenticates the caller. A password-reset token also carries `id`
		// and is signed with the same secret (GHSA-28wv-vrxj-rp4q).
		if (!isAccessTokenPayload(jwtPayload)) {
			throw new ForbiddenException('Invalid or expired authentication token.');
		}

		const callerUserId = jwtPayload.id;

		// The route is @Public(), so JwtStrategy never runs for it and nothing has re-checked this
		// caller against the database. Do it here rather than trusting the token's `role` / `tenantId`
		// claims: those are frozen at issuance, so a demoted (or deactivated) admin would otherwise keep
		// creating users with assigned roles for the token's whole lifetime.
		const caller = await this.findCaller(callerUserId);

		// Same exact predicates as JwtStrategy and token issuance: an unknown (NULL) status is refused.
		if (!caller || caller.isActive !== true || caller.isArchived !== false) {
			throw new ForbiddenException('Invalid or expired authentication token.');
		}

		const authorization = await this.roleAuthorizationService.getAuthorizationState(caller.roleId);
		const callerRole = authorization?.role?.name as RolesEnum;
		const callerTenantId = caller.tenantId;

		if (!callerUserId || !callerTenantId || !callerRole) {
			throw new ForbiddenException('Authentication token is missing required claims (id, tenantId, role).');
		}

		// Only ADMIN and SUPER_ADMIN can use privileged registration fields
		if (callerRole !== RolesEnum.SUPER_ADMIN && callerRole !== RolesEnum.ADMIN) {
			throw new ForbiddenException(
				'Insufficient privileges: only ADMIN or SUPER_ADMIN can create users with assigned roles, tenants, or organizations.'
			);
		}

		// Get ORM type from request context
		const ormType = getORMType();

		// Validate tenant isolation for roleId (top-level or nested in user)
		const targetRoleId = body.user?.roleId ?? getIdFromRelation(body.user?.role);
		if (targetRoleId && typeof targetRoleId === 'string') {
			try {
				const whereCondition = {
					id: targetRoleId,
					tenantId: callerTenantId
				};

				const role = await (ormType === MultiORMEnum.MikroORM
					? this.mikroOrmRoleRepository.findOneOrFail(whereCondition)
					: this.typeOrmRoleRepository.findOneByOrFail(whereCondition));

				// Verify the target role belongs to the caller's tenant
				if (role.tenantId !== callerTenantId) {
					throw new ForbiddenException(
						'Tenant isolation violation: the specified role does not belong to your tenant.'
					);
				}
			} catch (error) {
				if (error instanceof ForbiddenException) {
					throw error;
				}
				// Do not leak whether role exists in another tenant
				throw new ForbiddenException('The specified role does not exist.');
			}
		}

		// Validate tenant isolation for organizationId (top-level)
		const targetOrganizationId = body.organizationId;
		if (targetOrganizationId && typeof targetOrganizationId === 'string') {
			try {
				const whereCondition = {
					id: targetOrganizationId,
					tenantId: callerTenantId
				};

				const organization = await (ormType === MultiORMEnum.MikroORM
					? this.mikroOrmOrganizationRepository.findOneOrFail(whereCondition)
					: this.typeOrmOrganizationRepository.findOneByOrFail(whereCondition));

				// Verify the target organization belongs to the caller's tenant
				if (organization.tenantId !== callerTenantId) {
					throw new ForbiddenException(
						'Tenant isolation violation: the specified organization does not belong to your tenant.'
					);
				}
			} catch (error) {
				if (error instanceof ForbiddenException) {
					throw error;
				}
				// Do not leak whether org exists in another tenant
				throw new ForbiddenException('The specified organization does not exist.');
			}
		}

		// Validate tenant isolation for tenantId (nested in user)
		const targetTenantId = body.user?.tenantId ?? getIdFromRelation(body.user?.tenant);
		if (targetTenantId && targetTenantId !== callerTenantId) {
			throw new ForbiddenException(
				'Tenant isolation violation: you can only create users within your own tenant.'
			);
		}

		// Security: Always override createdByUserId with the authenticated caller's ID.
		// Never trust client-provided values for this field.
		body.createdByUserId = callerUserId;

		// Set request.user so RequestContext.currentTenantId() is available for the rest of the request.
		// The register route is @Public(), so the JWT strategy never runs and never sets req.user.
		// Without this, RoleShouldExistConstraint (and anything else using RequestContext) sees no tenant.
		(request as { user?: RegisterRequestUser }).user = {
			id: caller.id,
			tenantId: callerTenantId,
			roleId: caller.roleId,
			role: authorization.role,
			permissions: authorization.permissions
		};

		return true;
	}
}
