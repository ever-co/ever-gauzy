import { print } from 'graphql';
import { schemaExtensions } from './schema-extensions';

/**
 * The retry key in the payment plugin's contribution to the schema (17-graphql-api-specification.md §6.1).
 *
 * A GraphQL request is one `POST` carrying as many mutations as its document selects, so a retry key
 * cannot ride in a header: it rides beside the input it qualifies, as the `idempotencyKey` member. The
 * suite pins the two properties a client and the kernel both depend on:
 *
 * - **every mutation that mirrors a route which declares a scope declares the member**, so a client
 *   that retries over GraphQL has somewhere to present its key — the list below is the mirror of the
 *   decorated operations, and a mutation missing from it is one a client cannot retry safely;
 * - **the member is nullable**, because the refusal for a missing key is the kernel's own answer
 *   (`IDEMPOTENCY_KEY_REQUIRED`, the same code and status REST answers with) rather than a schema
 *   error. Declaring it non-null would answer with the transport's own shape instead, and would state
 *   the requirement in a second place that can drift from the kernel.
 *
 * The document itself is read, rather than the TypeScript that builds it, so a member added to one and
 * forgotten in the other fails here.
 */

/** The composed schema document, as text, so a declaration can be asserted the way a client reads it. */
const schemaText = print(schemaExtensions);

/**
 * The mutations that mirror a decorated route, and the input each of them declares.
 *
 * The list is the payment domain's own: the five operations whose retry key is required — a capture, a
 * refund, an account and its verification, and an instrument — and the seven that honour a key when a
 * client presents one.
 */
const MIRRORS: ReadonlyArray<readonly [string, string]> = [
	['createPaymentProvider', 'CreatePaymentProviderInput'],
	['createPaymentCollection', 'CreatePaymentCollectionInput'],
	['openPaymentSession', 'OpenPaymentSessionInput'],
	['authorizePaymentSession', 'AuthorizePaymentSessionInput'],
	['voidPaymentSession', 'VoidPaymentSessionInput'],
	['capturePayment', 'CapturePaymentInput'],
	['createRefund', 'CreateRefundInput'],
	['createRefundReason', 'CreateRefundReasonInput'],
	['reprocessPaymentWebhookEvent', 'ReprocessPaymentWebhookEventInput'],
	['createPaymentAccountHolder', 'CreatePaymentAccountHolderInput'],
	['verifyPaymentAccountHolder', 'VerifyPaymentAccountHolderInput'],
	['createPaymentMethodToken', 'CreatePaymentMethodTokenInput']
];

/**
 * The body of one input type, as the printed document spells it.
 *
 * @param name The input type's name.
 * @returns The declarations between its braces.
 */
function inputBody(name: string): string {
	const declaration = new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schemaText);

	if (!declaration) {
		throw new Error(`The schema declares no ${name}.`);
	}

	return declaration[1];
}

describe('the schema — the retry key on the mutations that mirror a decorated route (17 §6.1)', () => {
	it('declares the twelve mirrors of the decorated operations', () => {
		for (const [mutation, input] of MIRRORS) {
			expect(schemaText).toMatch(new RegExp(`${mutation}\\(input: ${input}!\\)`));
		}
	});

	it('declares the key on the input of every one of them', () => {
		for (const [, input] of MIRRORS) {
			expect(inputBody(input)).toMatch(/\bidempotencyKey:\s*String\b/);
		}
	});

	it('declares the key nullable everywhere, because the refusal is the kernel’s own', () => {
		// A non-null member would be refused by the schema before the mutating field ran, with the
		// transport's error shape rather than the platform's code.
		expect(schemaText).not.toMatch(/idempotencyKey:\s*String!/);

		for (const [, input] of MIRRORS) {
			// Stated, and stated without the `!`: the member ends its line, and the pattern refuses the
			// one character that would turn the declaration into a requirement.
			expect(inputBody(input)).toMatch(/\bidempotencyKey:\s*String(?!\S)/);
		}
	});
});
