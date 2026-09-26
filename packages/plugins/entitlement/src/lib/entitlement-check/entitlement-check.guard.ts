import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ID } from '@gauzy/contracts';
import { EntitlementCheckService } from './entitlement-check.service';
import { ENTITLEMENT_REQUIRED_METADATA } from './entitlement-required.decorator';

/**
 * The guard another package gates on.
 *
 * It exists so that consuming an entitlement never means importing a repository or re-implementing
 * the check: a handler is decorated with `@RequireEntitlement()` and this guard asks the exported
 * check service whether the caller may proceed. A refusal is a `403` carrying the stable code, which
 * is the answer a caller can act on — and it is deliberately not a `404`, because hiding a denial
 * behind a not-found makes "you may not" and "there is no such right" indistinguishable.
 */
@Injectable()
export class EntitlementRequiredGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly entitlementCheckService: EntitlementCheckService
	) {}

	/**
	 * @param context The execution context of the handler.
	 * @returns True when the handler is not gated, or the caller holds the right it names.
	 * @throws ForbiddenException carrying the stable code when the caller does not.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const required = this.reflector.getAllAndOverride<boolean>(ENTITLEMENT_REQUIRED_METADATA, [
			context.getHandler(),
			context.getClass()
		]);

		if (!required) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const entitlementId: ID | undefined =
			request?.params?.entitlementId ?? request?.body?.entitlementId ?? request?.params?.id;

		const result = await this.entitlementCheckService.check({
			entitlementId,
			key: request?.body?.key,
			deviceId: request?.body?.deviceId ?? request?.headers?.['x-device-id'],
			seatReference: request?.body?.seatReference
		});

		if (!result.allowed) {
			throw new ForbiddenException(result.reason);
		}

		return true;
	}
}
