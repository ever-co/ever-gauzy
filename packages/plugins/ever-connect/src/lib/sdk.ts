/**
 * The parts of the Ever Platform SDK (`@ever-co/connect-sdk`, with its contracts package
 * `@ever-co/connect-contracts`) this plugin uses: the client over the generated operation table, the
 * key manifest and entitlement verifier, the key rotation, the compact JWS signer (the statistics
 * link statement) and the claims reader for documents verified before they were stored, the errors
 * it throws, and the shared integration definitions and wire constants.
 */
export {
	claimsOfVerifiedJws,
	createEverPlatformClient,
	EgressRefusedError,
	EntitlementError,
	entitlementStatus,
	isLocalHost,
	KeyManifestError,
	KeySet,
	NotConnectedError,
	ProblemError,
	RateLimitedError,
	RequestRefusedError,
	ResponseTooLargeError,
	signCompactJws,
	signKeyRotation,
	TimeoutError,
	verifyEntitlement
} from '@ever-co/connect-sdk';
export type {
	CachedEntitlement,
	EntitlementStatus,
	EverPlatformClient,
	EverPlatformClientOptions,
	StoredKeySet,
	VerifiedEntitlement
} from '@ever-co/connect-sdk';
export { CONSTANTS, INTEGRATIONS, SCHEMAS } from '@ever-co/connect-contracts';
export type { EventEnvelope, IntegrationDefinition, IntegrationKey } from '@ever-co/connect-contracts';
