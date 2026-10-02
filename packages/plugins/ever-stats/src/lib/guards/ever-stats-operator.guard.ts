import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';

/**
 * Lets only the operator of this installation through (see `EverOperatorService`): a super admin
 * named in `EVER_OPERATOR_EMAILS`, or the first super admin of a single-tenant installation, and
 * nobody on Ever's cloud. Everyone else gets 404, as if the route did not exist, because the report
 * aggregates every tenant of the installation.
 *
 * It reads the user the authentication guard attached to the request: the database state of the
 * caller (their role right now), not the claims of their token.
 */
@Injectable()
export class EverStatsOperatorGuard implements CanActivate {
	constructor(private readonly operator: EverOperatorService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
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
