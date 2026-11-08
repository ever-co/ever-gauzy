import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { ProvisionIntentClaims } from './ever-connect-intent-verifier.service';

/** The plans Ever Platform signs into a provisioning request that this installation knows. */
export const KNOWN_TIERS: ReadonlyArray<string> = Object.freeze(['starter', 'small_business', 'enterprise']);

/**
 * The entitlement check of creating a workspace from Ever. Ever Platform signs a request only after
 * the owner's plan exists (a free or a paid one), and names it in the request (`tier`): that signed
 * plan is the entitlement this check trusts. It makes no call to a payment provider and reads no
 * payment setting, on any installation; Gauzy's own subscription check of its register route is not
 * involved and stays as it is. A request naming a plan this installation does not know is refused
 * (422 `validation_failed`).
 */
@Injectable()
export class EverConnectProvisionGate {
	/** @throws UnprocessableEntityException for a plan this installation does not know. */
	check(claims: Pick<ProvisionIntentClaims, 'tier'>): { tier: string } {
		if (!KNOWN_TIERS.includes(claims?.tier)) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				code: 'validation_failed',
				message: 'The plan of this request is not one this installation knows.'
			});
		}
		return { tier: claims.tier };
	}
}
