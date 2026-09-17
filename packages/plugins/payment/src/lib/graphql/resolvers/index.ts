import { PaymentCaptureResolver } from './payment-capture.resolver';
import { PaymentCollectionResolver } from './payment-collection.resolver';
import { PaymentProviderResolver } from './payment-provider.resolver';
import { PaymentSessionResolver } from './payment-session.resolver';
import { PaymentWebhookEventResolver } from './payment-webhook-event.resolver';
import { RefundLineResolver } from './refund-line.resolver';
import { RefundReasonResolver } from './refund-reason.resolver';
import { RefundResolver } from './refund.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces run
 * through one implementation of every rule.
 *
 * One resolver per aggregate, and one root field per operation the REST surface offers. A root field
 * declared in the SDL with no resolver behind it is a field a client can select and never receive, so
 * the two files change together.
 */
export const resolvers = [
	PaymentProviderResolver,
	PaymentCollectionResolver,
	PaymentSessionResolver,
	PaymentCaptureResolver,
	RefundResolver,
	RefundLineResolver,
	RefundReasonResolver,
	PaymentWebhookEventResolver
];

export {
	PaymentProviderResolver,
	PaymentCollectionResolver,
	PaymentSessionResolver,
	PaymentCaptureResolver,
	RefundResolver,
	RefundLineResolver,
	RefundReasonResolver,
	PaymentWebhookEventResolver
};
