/**
 * The parts of the Ever Platform SDK this plugin uses, from the vendored copy (`./vendor`, see
 * `scripts/vendor-connect-sdk.mjs`): the client over the generated operation table, the key manifest
 * and entitlement verifier, and the JWS signer for the statistics link statement.
 */
export { createEverPlatformClient } from './vendor/connect-sdk/client';
export type { EverPlatformClient, EverPlatformClientOptions } from './vendor/connect-sdk/client';
export { entitlementStatus, verifyEntitlement } from './vendor/connect-sdk/entitlement';
export type { CachedEntitlement, EntitlementStatus, VerifiedEntitlement } from './vendor/connect-sdk/entitlement';
export {
	EgressRefusedError,
	EntitlementError,
	KeyManifestError,
	NotConnectedError,
	ProblemError,
	RateLimitedError,
	RequestRefusedError,
	ResponseTooLargeError,
	TimeoutError
} from './vendor/connect-sdk/errors';
export { decodeJws, signJws } from './vendor/connect-sdk/jws';
export { KeySet } from './vendor/connect-sdk/keyset';
export type { StoredKeySet } from './vendor/connect-sdk/keyset';
export { CONSTANTS, INTEGRATIONS, SCHEMAS } from './vendor/connect-contracts';
export type { EventEnvelope, IntegrationDefinition, IntegrationKey } from './vendor/connect-contracts';
