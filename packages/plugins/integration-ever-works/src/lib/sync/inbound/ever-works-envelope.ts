import type { EverWorksEventEnvelope } from '../../client/ever-works-client.types';

/** Why an envelope is refused (safe to log: never echoes the payload). */
export class EverWorksEnvelopeError extends Error {
	constructor(reason: string) {
		super(`Invalid Ever Works event envelope: ${reason}.`);
		this.name = 'EverWorksEnvelopeError';
	}
}

const isString = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

/**
 * Checks the shape the engine relies on (contract v1 §B.3) and returns the envelope typed. Unknown
 * properties are kept (v1 grows additively); missing or malformed required ones are refused.
 */
export function parseEverWorksEnvelope(value: unknown): EverWorksEventEnvelope {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EverWorksEnvelopeError('not an object');
	const e = value as Record<string, unknown>;
	if (!isString(e['id'], 64)) throw new EverWorksEnvelopeError('id');
	if (typeof e['seq'] !== 'string' || !/^\d{1,20}$/.test(e['seq'])) throw new EverWorksEnvelopeError('seq');
	if (!isString(e['type'], 64) || !/^[a-z_]+(\.[a-z_]+)+$/.test(e['type'])) throw new EverWorksEnvelopeError('type');
	if (!isString(e['tenantId'], 64)) throw new EverWorksEnvelopeError('tenantId');
	if (e['organizationId'] !== null && e['organizationId'] !== undefined && !isString(e['organizationId'], 64)) {
		throw new EverWorksEnvelopeError('organizationId');
	}
	const aggregate = e['aggregate'] as Record<string, unknown> | undefined;
	if (!aggregate || typeof aggregate !== 'object' || !isString(aggregate['type'], 32) || !isString(aggregate['id'], 64)) {
		throw new EverWorksEnvelopeError('aggregate');
	}
	if (aggregate['version'] !== undefined && aggregate['version'] !== null && !Number.isInteger(aggregate['version'])) {
		throw new EverWorksEnvelopeError('aggregate.version');
	}
	if (e['data'] === undefined || e['data'] === null || typeof e['data'] !== 'object') throw new EverWorksEnvelopeError('data');
	return value as EverWorksEventEnvelope;
}

/** Compares two feed positions as integers (they are strings and may exceed 2^53). */
export function compareSeq(a: string, b: string): number {
	const x = BigInt(a);
	const y = BigInt(b);
	return x < y ? -1 : x > y ? 1 : 0;
}
