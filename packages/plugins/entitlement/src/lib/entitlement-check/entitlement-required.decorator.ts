import { SetMetadata } from '@nestjs/common';

/**
 * The metadata key the guard reads.
 *
 * Exported because a package outside this one may want to assert its own handler carries the
 * declaration — a route that consumes an entitlement and forgets to gate on one is exactly the kind
 * of omission a test should be able to look for.
 */
export const ENTITLEMENT_REQUIRED_METADATA = 'ENTITLEMENT_REQUIRED';

/**
 * Declares that a handler may only run for a caller that holds a right.
 *
 * The declaration is all this decorator does. The decision belongs to `EntitlementCheckService`,
 * which is the same service the check endpoint and the activation path run through, so a route gated
 * this way and a client calling the check API cannot disagree about whether the customer is entitled
 * — there is one implementation of that question in the platform and this is the door to it.
 *
 * The right is identified from the request: `params.entitlementId` when the route names one,
 * otherwise the body's `entitlementId`, or `params.id` when the route is about the right itself.
 *
 * @returns The decorator.
 */
export function RequireEntitlement(): MethodDecorator & ClassDecorator {
	return SetMetadata(ENTITLEMENT_REQUIRED_METADATA, true);
}
