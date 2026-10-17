import { FeatureEnum } from '@gauzy/contracts';
import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature code this domain is gated by.
 *
 * It is **not declared here.** `FEATURE_PAYMENT` already exists in the platform feature catalogue,
 * with its catalogue metadata, its icon and its settings link, and it already gates the payment
 * capability — the provider registry, collections, sessions, captures and refunds. Contributing
 * `FEATURE_COMMERCE_PAYMENT` beside it would give an administrator two switches for one capability
 * and would let them disagree, so the existing code is reused unchanged and this package contributes
 * nothing to the feature catalogue.
 *
 * @param code The feature code.
 * @returns The code, as the platform feature enum.
 */
export function paymentFeature(code: string): FeatureEnum {
	return code as unknown as FeatureEnum;
}

/**
 * The feature flag the payment domain is gated by, for a caller that must read it.
 */
export const PaymentFeature = {
	/** The payment capability: provider registry, collections, sessions, captures and refunds. */
	PAYMENT: paymentFeature('FEATURE_PAYMENT')
} as const;

/**
 * The feature contributions of this package: **none, deliberately**.
 *
 * Three reasons, recorded because an empty array is otherwise indistinguishable from an omission.
 *
 * 1. **The code already exists.** `FEATURE_PAYMENT` is in the platform catalogue and is reused, not
 *    re-declared: a second code for the same capability is two switches that can disagree.
 * 2. **Nothing here needs a new switch.** The tables of this package are empty until a provider is
 *    registered, so installing it changes no behaviour; the capability is switched by
 *    `FEATURE_PAYMENT`, and the flows that reach into saved instruments are switched by the module
 *    flags that own those flows — the subscription and marketplace features — rather than by a flag
 *    of their own. A flag that can be turned off while a subscription still points at a saved
 *    instrument is a flag that breaks the capability it belongs to.
 * 3. **The inbound provider callback route is never gated by a flag.** A provider signs and posts to
 *    one URL; if a flag could hide that route, the provider's retries would fail against a surface
 *    that no longer exists and the money state would drift from the provider's own record with
 *    nothing to reconcile it. Access to the callback *log* is a permission, and so is re-processing
 *    an event; the intake itself is always present, verifies the signature and always answers.
 */
export const PAYMENT_FEATURES: PluginFeatureContribution[] = [];
