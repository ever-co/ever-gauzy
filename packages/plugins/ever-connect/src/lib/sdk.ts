/**
 * The parts of the Ever Platform SDK (`@ever-co/connect-sdk`, with its contracts package
 * `@ever-co/connect-contracts`) this plugin uses: the client over the generated operation table, the
 * key manifest and entitlement verifier, the errors it throws, and the shared integration
 * definitions and wire constants.
 */
export {
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
export { readJwsPayload, signCompactJws } from './compact-jws';
