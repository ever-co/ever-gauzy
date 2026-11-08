/**
 * The parts of the Ever Platform SDK (`@ever-co/connect-sdk`, with its contracts package
 * `@ever-co/connect-contracts`) this plugin uses: the client over the generated operation table, the
 * key manifest and entitlement verifier, the key rotation, the compact JWS signer (the statistics
 * link statement) and the claims reader for documents verified before they were stored, the errors
 * it throws, the shared integration definitions and wire constants, and the counterparty check's
 * normalisation and salted hash (the only implementation: never one of this plugin's own).
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
	LookupInputError,
	lookupHash,
	normalizeIdentifier,
	NORMALIZATION_VERSION,
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
	LookupHash,
	LookupKind,
	LookupSalt,
	StoredKeySet,
	VerifiedEntitlement
} from '@ever-co/connect-sdk';
export { CONSTANTS, INTEGRATIONS, SCHEMAS } from '@ever-co/connect-contracts';
export type { EventEnvelope, IntegrationDefinition, IntegrationKey } from '@ever-co/connect-contracts';
