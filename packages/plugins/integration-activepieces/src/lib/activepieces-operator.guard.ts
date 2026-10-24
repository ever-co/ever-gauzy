import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isInstallationOperator } from '@gauzy/core';

/** The `code` of the refusal {@link ActivepiecesOperatorGuard} answers. */
export const ACTIVEPIECES_OPERATOR_ONLY = 'ACTIVEPIECES_OPERATOR_ONLY';

/**
 * Lets through only the operator of the installation: a super admin listed by user id in `EVER_OPERATOR_USER_IDS`
 * (nobody when the list is unset, not even the super admin of a single tenant).
 *
 * It guards the routes that act under the installation's Activepieces platform key without a tenant's project pinned
 * (the platform's projects, any project's connections and MCP servers, a tenant's project): that key reaches every
 * project of the platform, so no tenant's admins may use it that way, however many permissions their role holds.
 */
@Injectable()
export class ActivepiecesOperatorGuard implements CanActivate {
	canActivate(_context: ExecutionContext): boolean {
		if (isInstallationOperator()) {
			return true;
		}
		throw new ForbiddenException({
			message: `${ACTIVEPIECES_OPERATOR_ONLY}: only the operator of this installation (EVER_OPERATOR_USER_IDS) may use the Activepieces platform routes.`,
			code: ACTIVEPIECES_OPERATOR_ONLY
		});
	}
}
