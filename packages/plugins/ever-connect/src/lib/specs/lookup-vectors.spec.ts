import { readFileSync } from 'node:fs';
import { hashOf, normaliseItem } from '../ever-connect-lookup.service';

/**
 * The published test vectors of the counterparty check (`GET /v1/lookup/test-vectors`, shipped in
 * the SDK's contracts package): every row is reproduced by the path this plugin hashes with (the
 * SDK's normalisation and salted hash), under the test salt (version 0, never accepted by a query),
 * and every refused input is answered "cannot be checked" for its reason.
 */
interface Vectors {
	salt_version: number;
	salt: string;
	normalization_version: number;
	vectors: Array<{
		kind: 'vat' | 'registration' | 'email';
		input: string;
		country?: string;
		normalized: string;
		hash: string;
	}>;
	refused: Array<{ kind: 'vat' | 'registration' | 'email'; input: string; country?: string; reason: string }>;
}

const VECTORS: Vectors = JSON.parse(
	readFileSync(require.resolve('@ever-co/connect-contracts/fixtures/lookup/test-vectors.json'), 'utf8')
);

describe('the counterparty check: published test vectors', () => {
	it('are the test salt (version 0), normalisation version 1, with the six rows of the contract first', () => {
		expect(VECTORS.salt_version).toBe(0);
		expect(VECTORS.salt).toBe('oXdv2Z2X27XAr8ToW3-GHP6OD-AetKCiA4oRkF_FnWM');
		expect(VECTORS.normalization_version).toBe(1);
		expect(VECTORS.vectors.slice(0, 6).map((row) => row.hash)).toEqual([
			'12c9b8f891583acaea6dc0f86233ea527c32c31e0bd818c329a7105d3beaf366',
			'12c9b8f891583acaea6dc0f86233ea527c32c31e0bd818c329a7105d3beaf366',
			'4bdabbf37545dc49a7c8ac4a4431fa7f973da56cf8c24b9120d971527d2502ae',
			'bc070adf3c0ecacf78ef7e53189f984eec9f1a1c85899cffd2317258cec7ba0c',
			'115359ae4e546210526840c005fb832d7ee51e44f19fdfed8f163c04340f9582',
			'3116007e07691603630786b813de99da03048dfddad522e98f9e01ed72904068'
		]);
		expect(VECTORS.vectors.length).toBeGreaterThanOrEqual(6);
		expect(VECTORS.refused.length).toBeGreaterThan(0);
	});

	it.each(VECTORS.vectors.map((row, index) => [index, row] as const))('vector %i is reproduced', (_index, row) => {
		const outcome = normaliseItem({ kind: row.kind, value: row.input, country: row.country ?? null });
		expect(outcome).toEqual({ normalized: row.normalized });
		expect(hashOf(row.kind, row.normalized, { version: VECTORS.salt_version, salt: VECTORS.salt })).toBe(row.hash);
	});

	it.each(VECTORS.refused.map((row, index) => [index, row] as const))(
		'refused input %i cannot be checked',
		(_index, row) => {
			expect(normaliseItem({ kind: row.kind, value: row.input, country: row.country ?? null })).toEqual({
				reason: row.reason
			});
		}
	);

	it('a changed hash would be caught (control)', () => {
		const row = VECTORS.vectors[0];
		expect(hashOf(row.kind, row.normalized, { version: 0, salt: VECTORS.salt })).not.toBe(
			hashOf(row.kind, `${row.normalized}0`, { version: 0, salt: VECTORS.salt })
		);
	});
});
