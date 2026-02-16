import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { environment as env } from '@gauzy/config';
import { RolesEnum } from '@gauzy/contracts';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../core/context';
import { TypeOrmRoleRepository } from '../../role/repository/type-orm-role.repository';

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
 *  4. createdByUserId is overridden with the authenticated caller's ID
 */
const PRIVILEGED_FIELDS: string[] = [
	'roleId',
	'organizationId',
	'createdByUserId',
	'featureAsEmployee'
];

/**
 * Privileged fields that may appear nested inside `body.user`.
 */
const PRIVILEGED_USER_FIELDS: string[] = [
	'role',
	'roleId',
	'tenant',
	'tenantId'
];

/**
 * Guard that protects the public registration endpoint
 *
 * The `/api/auth/register` endpoint is @Public() (no global AuthGuard).
 * This guard inspects the request body:
 *  - If no privileged fields are present → pure public registration → allow through.
 *  - If privileged fields are present → require a valid JWT from an ADMIN/SUPER_ADMIN
 *    and verify tenant isolation for any supplied roleId.
 */
@Injectable()
export class RegisterAuthorizationGuard implements CanActivate {
	constructor(
		private readonly typeOrmRoleRepository: TypeOrmRoleRepository
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const body = request.body || {};

		// Check if any privileged fields are present in the request body
		const hasPrivilegedTopLevel = PRIVILEGED_FIELDS.some(
			(field) => body[field] !== undefined && body[field] !== null
		);

		const userPayload = body.user || {};
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
			throw new ForbiddenException(
				'Invalid or expired authentication token.'
			);
		}

		const callerRole = jwtPayload.role;
		const callerTenantId = jwtPayload.tenantId;
		const callerUserId = jwtPayload.id;

		// Only ADMIN and SUPER_ADMIN can use privileged registration fields
		if (callerRole !== RolesEnum.SUPER_ADMIN && callerRole !== RolesEnum.ADMIN) {
			throw new ForbiddenException(
				'Insufficient privileges: only ADMIN or SUPER_ADMIN can create users with assigned roles, tenants, or organizations.'
			);
		}

		// Validate tenant isolation for roleId (top-level or nested in user)
		// Use typeof check to safely handle cases where role might be a non-object value
		const userRole = body.user?.role;
		const targetRoleId = body.user?.roleId || (typeof userRole === 'object' && userRole !== null && userRole?.id);
		if (targetRoleId) {
			try {
				const role = await this.typeOrmRoleRepository.findOneByOrFail({ id: targetRoleId });

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
				throw new ForbiddenException(
					'The specified role does not exist.'
				);
			}
		}

		// Validate tenant isolation for tenantId (nested in user)
		// Use typeof check to safely handle cases where tenant might be a non-object value
		const userTenant = body.user?.tenant;
		const targetTenantId = body.user?.tenantId || (typeof userTenant === 'object' && userTenant !== null && userTenant?.id);
		if (targetTenantId && targetTenantId !== callerTenantId) {
			throw new ForbiddenException(
				'Tenant isolation violation: you can only create users within your own tenant.'
			);
		}

		// Security: Always override createdByUserId with the authenticated caller's ID.
		// Never trust client-provided values for this field.
		body.createdByUserId = callerUserId;

		return true;
	}
}
