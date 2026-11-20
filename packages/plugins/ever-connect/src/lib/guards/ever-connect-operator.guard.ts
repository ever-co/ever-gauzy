import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { isEverConnectEnabled } from '../ever-connect-enabled';
import { EverConnectOperatorService } from '../ever-connect-operator.service';
import { EVER_CONNECT_ENV } from '../ever-connect.constants';

/** The role name of the signed-in user, as the authentication guard attached it. */
export function roleNameOf(user: { role?: string | { name?: string } } | null | undefined): string | null {
	const role = user?.role;
	return typeof role === 'string' ? role : (role?.name ?? null);
}

/**
 * Lets only the operator of this installation's connection through (`EverConnectOperatorService`): a
 * super admin named in `EVER_OPERATOR_USER_IDS` or `EVER_OPERATOR_EMAILS`, or the first super admin of
 * a single-tenant installation; on Ever's cloud (`EVER_INSTALL_SOURCE=cloud`) only a super admin listed
 * by id in `EVER_CONNECT_CLOUD_OPERATOR_USER_IDS` (nobody when it is unset); nobody on an installation
 * with several tenants that names no operator. Everyone else gets 404, as if the route did not exist:
 * connecting, disconnecting, the instance policy and the installation-wide integrations are the
 * installation's, not a tenant's. With `EVER_CONNECT_ENABLED` no longer `true` (read again here)
 * everyone gets 404.
 *
 * It reads the user the authentication guard attached to the request, then the database state of
 * that user (their role right now), never the claims of their token.
 */
@Injectable()
export class EverConnectOperatorGuard implements CanActivate {
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly operator: EverConnectOperatorService,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!isEverConnectEnabled(this.env)) {
			throw new NotFoundException();
		}
		const user = context.switchToHttp().getRequest()?.user;
		if (await this.operator.isOperator(user, roleNameOf(user))) {
			return true;
		}
		throw new NotFoundException();
	}
}

/**
 * Every route of the module answers 404 once `EVER_CONNECT_ENABLED` is no longer `true` (a settings
 * file read after the plugin list was built).
 */
@Injectable()
export class EverConnectEnabledGuard implements CanActivate {
	private readonly env: Record<string, string | undefined>;

	constructor(@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>) {
		this.env = env ?? process.env;
	}

	canActivate(): boolean {
		if (!isEverConnectEnabled(this.env)) {
			throw new NotFoundException();
		}
		return true;
	}
}
