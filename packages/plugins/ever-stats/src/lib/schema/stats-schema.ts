import { SCHEMAS } from '@ever-co/connect-contracts';

/**
 * The `ever.stats.v1` schema, from the SDK's contracts package (`@ever-co/connect-contracts`): byte
 * for byte the one Ever Platform publishes at `GET /v1/stats/schema` (`schema.drift.spec.ts` pins
 * its SHA-256). The checks Ever Platform runs on a report are the SDK's (`validateStatsReportBytes`).
 */
export const STATS_SCHEMA: { readonly [key: string]: unknown } = SCHEMAS.stats as unknown as {
	readonly [key: string]: unknown;
};

/** The SHA-256 of the published schema file (its `ETag` on Ever Platform). */
export const SCHEMA_SHA256 = '0cd746f7dec75117a6b812b7a832f9ceca4c97a6ecf65d22d6967a6475efc6e5';
