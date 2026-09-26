import { OmitType, PartialType } from '@nestjs/mapped-types';
import { EntitlementActivationDTO } from './entitlement-activation.dto';

/**
 * An edit to an activation.
 *
 * Only descriptive fields are open: the device identity is what the seat count is taken over, and a
 * body that could rewrite it would let a client move a slot to a different machine without going
 * through the activation path the limit is enforced on.
 *
 * That was this class's promise while its metadata still declared the whole `EntitlementActivationDTO`,
 * so the route accepted — and the inherited update wrote — the five members that break it: `status`
 * (a `REVOKED` slot set back to `ACTIVE` sat beside the one that replaced it, past `activationLimit`,
 * because the limit is only counted when a slot is taken), `entitlementId` (a slot repointed to another
 * right without that right's limit being counted), `entitlementKeyId` (a slot detached from the key whose
 * revocation releases it), `deviceId` (the identity the seat count and the device bar are taken over) and
 * `revocationReason` (which decides whether a revoked device may come back). They are omitted here, the
 * GraphQL input omits the same five, and `EntitlementActivationService.update` refuses them whichever way
 * they arrive; a slot's state moves through release and revoke, and a slot is taken through activate.
 */
export class UpdateEntitlementActivationDTO extends PartialType(
	OmitType(EntitlementActivationDTO, [
		'entitlementId',
		'entitlementKeyId',
		'deviceId',
		'status',
		'revocationReason'
	] as const)
) {}
