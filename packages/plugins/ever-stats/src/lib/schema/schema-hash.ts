/**
 * The vendored `ever.stats.v1` schema is byte for byte the one Ever Platform publishes at
 * `GET /v1/stats/schema` (its `ETag` is this SHA-256). Copied from ever-co/ever-connect-sdk at the
 * commit below, which carries the platform's copy; `schema.drift.spec.ts` fails when the file changes.
 */
export const SCHEMA_SHA256 = '0cd746f7dec75117a6b812b7a832f9ceca4c97a6ecf65d22d6967a6475efc6e5';

/** Where the vendored schema, fixtures and checks were copied from. */
export const SCHEMA_SOURCE = Object.freeze({
	repository: 'ever-co/ever-connect-sdk',
	commit: '2fd74da',
	schema: 'contracts/schemas/ever.stats.v1.json',
	fixtures: 'contracts/fixtures/stats/',
	checks: 'packages/ts/connect-sdk/src/stats/checks.ts'
});
