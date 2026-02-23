import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { environment as env } from '@gauzy/config';
import { RolesEnum } from '@gauzy/contracts';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../core/context';
import { TypeOrmRoleRepository } from '../../role/repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from '../../role/repository/mikro-orm-role.repository';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from '../../organization/repository/mikro-orm-organization.repository';
import { getORMType, MultiORMEnum } from '../../core/utils';

/**
 * Minimal user shape set on the request by this guard when the register route
 * is called with privileged fields by an authenticated admin. Ensures
 * RequestContext.currentTenantId() and related helpers are available for the rest of the request.
 */
export interface RegisterRequestUser {
	id: string;
	tenantId: string;
	role: RolesEnum;
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
 *  2. The caller is ADMIN or SUPER_ADMIN
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
 *  - If privileged fields are present → require a valid JWT from an ADMIN/SUPER_ADMIN
 *    and verify tenant isolation for any supplied roleId or organizationId.
 */
@Injectable()
export class RegisterAuthorizationGuard implements CanActivate {
	constructor(
		private readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		private readonly mikroOrmRoleRepository: MikroOrmRoleRepository,
		private readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		private readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {}

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

		// Verify the JWT and extract the payload
		let jwtPayload: { id: string; tenantId: string; role: RolesEnum };
		try {
			jwtPayload = verify(token, env.JWT_SECRET) as any;
		} catch {
			throw new ForbiddenException('Invalid or expired authentication token.');
		}

		const callerRole = jwtPayload.role;
		const callerTenantId = jwtPayload.tenantId;
		const callerUserId = jwtPayload.id;

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
			id: callerUserId,
			tenantId: callerTenantId,
			role: callerRole
		};

		return true;
	}
}
