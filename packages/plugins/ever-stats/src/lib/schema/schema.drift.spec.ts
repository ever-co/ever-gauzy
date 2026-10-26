import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { contractsFile } from '../fixtures/contracts-file';
import { SCHEMA_SHA256, STATS_SCHEMA } from './stats-schema';

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/**
 * The statistics contract this module sends against is the SDK's (`@ever-co/connect-contracts`, the
 * exact version in package.json): byte for byte the schema Ever Platform publishes. A new package
 * version that changes the schema fails here until the change is reviewed.
 */
describe('the statistics contract', () => {
	it('is byte for byte the published schema', () => {
		expect(sha256(readFileSync(contractsFile('schemas', 'ever.stats.v1.json')))).toBe(SCHEMA_SHA256);
	});

	it('is the schema the module reads', () => {
		expect(STATS_SCHEMA).toEqual(JSON.parse(readFileSync(contractsFile('schemas', 'ever.stats.v1.json'), 'utf8')));
		expect(STATS_SCHEMA['$id'] ?? STATS_SCHEMA['title']).toBeTruthy();
	});

	it('would notice a changed schema (control)', () => {
		const changed = readFileSync(contractsFile('schemas', 'ever.stats.v1.json'), 'utf8').replace('"ever.stats.v1"', '"ever.stats.v2"');
		expect(sha256(changed)).not.toBe(SCHEMA_SHA256);
	});
});
