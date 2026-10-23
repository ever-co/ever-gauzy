/**
 * The ids a subscription holds of rows it has no relation to: the customer it belongs to, the order it came from, and
 * the account holder and saved payment method that pay for it.
 *
 * None of those columns is a relation, so the platform's cross-tenant check, which reads the relation join columns of
 * a written row, never saw them: `createSubscription` writes the row on its transaction's manager, and an edit moves
 * the payer with a conditional update, both with the ids as the caller named them. The customer is carried onto every
 * order a billing run raises, and from there onto its invoice, which loads the contact.
 *
 * `SubscriptionService` holds these columns to the caller's tenant with `assertPlainReferencesNotForeign`
 * (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/** The plain id columns of a subscription. */
export const SUBSCRIPTION_REFERENCES: PlainReferenceColumns = {
	customerId: 'organization_contact',
	originOrderId: 'order',
	paymentAccountHolderId: 'payment_account_holder',
	paymentMethodTokenId: 'payment_method_token'
};
