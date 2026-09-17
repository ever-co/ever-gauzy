import { ApolloDriverConfig } from '@nestjs/apollo';

/**
 * The transport package the sub-protocol needs.
 */
export const GRAPHQL_SUBSCRIPTION_TRANSPORT_PACKAGE = 'graphql-ws';

/**
 * The module resolver, declared locally so this file compiles whether or not the ambient Node types
 * are in scope. The API is built as CommonJS, which is where `require` comes from.
 */
declare const require: { resolve(id: string): string };

/**
 * Whether the WebSocket sub-protocol can be enabled.
 *
 * The transport is a separate package and it is optional: an installation that has not installed it
 * serves queries and mutations exactly as before, and one that has gets subscriptions on the same
 * endpoint. The probe happens at boot and answers from what is actually installed, so a deployment
 * never has to keep a flag in step with its lockfile — and, more importantly, a missing optional
 * package can never stop the API from starting.
 *
 * @returns True when the driver can be told to serve subscriptions.
 */
export function supportsSubscriptionTransport(): boolean {
	try {
		require.resolve(GRAPHQL_SUBSCRIPTION_TRANSPORT_PACKAGE);
		return true;
	} catch {
		return false;
	}
}

/**
 * The driver options that turn on subscriptions on the one GraphQL endpoint.
 *
 * The sub-protocol rides the existing path — there is no second endpoint and no second
 * authorisation model. When the transport package is absent the key is omitted entirely, so the
 * driver is configured exactly as it is today.
 *
 * @returns The `subscriptions` option, or an empty object.
 */
export function subscriptionTransportOptions(): { subscriptions?: ApolloDriverConfig['subscriptions'] } {
	if (!supportsSubscriptionTransport()) {
		return {};
	}

	return { subscriptions: { 'graphql-ws': true } };
}
