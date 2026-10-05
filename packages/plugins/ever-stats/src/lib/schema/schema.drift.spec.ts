import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_SHA256 } from './schema-hash';

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/** The SHA-256 of `checks.ts` at the pinned commit of ever-co/ever-connect-sdk, before the provenance header. */
const CHECKS_SHA256 = '46e8404bbfda0a2029cd6dd360813f40bb0119a007a6e3c997d08cd0a3796f57';
const CHECKS_HEADER_LINES = 4;

describe('vendored statistics contract', () => {
	it('is byte for byte the published schema', () => {
		expect(sha256(readFileSync(join(__dirname, 'ever.stats.v1.schema.json')))).toBe(SCHEMA_SHA256);
	});

	it('runs the checks of the pinned SDK commit unchanged', () => {
		const text = readFileSync(join(__dirname, '../vendor/stats-checks.ts'), 'utf8');
		const body = text.split('\n').slice(CHECKS_HEADER_LINES).join('\n');
		expect(sha256(body)).toBe(CHECKS_SHA256);
	});

	it('would notice a changed schema (control)', () => {
		const changed = readFileSync(join(__dirname, 'ever.stats.v1.schema.json'), 'utf8').replace('"ever.stats.v1"', '"ever.stats.v2"');
		expect(sha256(changed)).not.toBe(SCHEMA_SHA256);
	});
});
