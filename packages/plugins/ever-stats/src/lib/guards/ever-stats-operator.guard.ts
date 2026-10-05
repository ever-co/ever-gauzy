import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';
import { isEverStatsEnabled } from '../ever-stats-enabled';
import { EVER_STATS_ENV } from '../ever-stats-scheduler.service';

/**
 * Lets only the operator of this installation through (see `EverOperatorService`): a super admin
 * named in `EVER_OPERATOR_USER_IDS` or `EVER_OPERATOR_EMAILS`, or the first super admin of a
 * single-tenant installation, and nobody on Ever's cloud. Every other signed-in user gets 404, as if
 * the route did not exist, because the report aggregates every tenant of the installation. With
 * `EVER_STATS_ENABLED=false` (read again here) everyone gets 404.
 *
 * It reads the user the authentication guard attached to the request: the database state of the
 * caller (their role right now), not the claims of their token.
 */
@Injectable()
export class EverStatsOperatorGuard implements CanActivate {
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly operator: EverOperatorService,
		@Optional() @Inject(EVER_STATS_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!isEverStatsEnabled(this.env)) {
			throw new NotFoundException();
		}
		const request = context.switchToHttp().getRequest();
		const user = request?.user;
		const role = user?.role;
		const roleName = typeof role === 'string' ? role : role?.name;
		if (await this.operator.isOperator(user, roleName)) {
			return true;
		}
		throw new NotFoundException();
	}
}
