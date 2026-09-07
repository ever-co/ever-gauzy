import { fuseRrf, RRF_CONFIDENCE_FLOOR, RRF_K } from './rrf';

describe('fuseRrf', () => {
	const hit = (chunkId: string) => ({ chunkId });

	it('scores a single-leg list as 1/(K+rank)', () => {
		const fused = fuseRrf([[hit('a'), hit('b'), hit('c')]], 10);
		expect(fused).toHaveLength(3);
		expect(fused[0].hit.chunkId).toBe('a');
		expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 1), 10);
		expect(fused[1].score).toBeCloseTo(1 / (RRF_K + 2), 10);
		expect(fused[2].score).toBeCloseTo(1 / (RRF_K + 3), 10);
	});

	it('sums contributions across legs and dedupes by chunk id', () => {
		const lexical = [hit('shared'), hit('lex-only')];
		const vector = [hit('vec-only'), hit('shared')];
		const fused = fuseRrf([lexical, vector], 10);

		const shared = fused.find((entry) => entry.hit.chunkId === 'shared')!;
		expect(shared.score).toBeCloseTo(1 / (RRF_K + 1) + 1 / (RRF_K + 2), 10);
		expect(shared.legs).toEqual([0, 1]);

		// A chunk ranked by both legs outranks single-leg #1 hits.
		expect(fused[0].hit.chunkId).toBe('shared');
		expect(fused).toHaveLength(3);
	});

	it('keeps the first-seen hit payload for duplicates', () => {
		const lexical = [{ chunkId: 'x', source: 'lexical' }];
		const vector = [{ chunkId: 'x', source: 'vector' }];
		const fused = fuseRrf<{ chunkId: string; source: string }>([lexical, vector], 10);
		expect(fused).toHaveLength(1);
		expect(fused[0].hit.source).toBe('lexical');
	});

	it('truncates to topK after sorting', () => {
		const leg = Array.from({ length: 20 }, (_, i) => hit(`c${i}`));
		const fused = fuseRrf([leg], 6);
		expect(fused).toHaveLength(6);
		expect(fused.map((entry) => entry.hit.chunkId)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
	});

	it('handles empty legs and empty input', () => {
		expect(fuseRrf([], 5)).toEqual([]);
		expect(fuseRrf([[], []], 5)).toEqual([]);
	});

	it('confidence floor equals a rank-5 single-leg contribution', () => {
		const fused = fuseRrf([[hit('1'), hit('2'), hit('3'), hit('4'), hit('5'), hit('6')]], 10);
		// Rank 5 sits exactly on the floor; rank 6 falls below it.
		expect(fused[4].score).toBeCloseTo(RRF_CONFIDENCE_FLOOR, 10);
		expect(fused[5].score).toBeLessThan(RRF_CONFIDENCE_FLOOR);
	});
});
