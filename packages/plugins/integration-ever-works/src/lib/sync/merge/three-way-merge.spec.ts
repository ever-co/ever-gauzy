import { mergeField, mergeRecord, mergeSets, sameSet, sameValue } from './three-way-merge';

const scalar = { kind: 'scalar' as const };
const set = { kind: 'set' as const };
const rich = { kind: 'richText' as const };

describe('3-way merge (plan 03 §C.5)', () => {
	it('only one side changed → take it', () => {
		expect(mergeField(scalar, 'a', 'b', 'a')).toMatchObject({ value: 'b', source: 'gauzy', conflict: false });
		expect(mergeField(scalar, 'a', 'a', 'c')).toMatchObject({ value: 'c', source: 'ever_works', conflict: false });
		expect(mergeField(scalar, 'a', 'a', 'a')).toMatchObject({ value: 'a', source: 'none', conflict: false });
	});

	it('both changed to the same value → no conflict', () => {
		expect(mergeField(scalar, 'a', 'z', 'z')).toMatchObject({ value: 'z', source: 'both', conflict: false });
	});

	it('both changed, scalar → last writer wins, the loser is reported', () => {
		const later = mergeField(scalar, 'a', 'g', 'e', '2026-10-15T10:00:05Z', '2026-10-15T10:00:00Z');
		expect(later).toEqual({ value: 'g', source: 'gauzy', conflict: true, loser: 'e', loserSide: 'ever_works' });
		const earlier = mergeField(scalar, 'a', 'g', 'e', '2026-10-15T09:00:00Z', '2026-10-15T10:00:00Z');
		expect(earlier).toEqual({ value: 'e', source: 'ever_works', conflict: true, loser: 'g', loserSide: 'gauzy' });
	});

	it('a tie, or a missing time, goes to Ever Works', () => {
		expect(mergeField(scalar, 'a', 'g', 'e', '2026-10-15T10:00:00Z', '2026-10-15T10:00:00Z').value).toBe('e');
		expect(mergeField(scalar, 'a', 'g', 'e', null, null).value).toBe('e');
		expect(mergeField(scalar, 'a', 'g', 'e', '2026-10-15T10:00:00Z', null).value).toBe('g');
	});

	it('rich text behaves like a scalar and keeps the losing version', () => {
		const result = mergeField(rich, 'old', '<p>gauzy</p>', 'ever works', '2026-10-15T10:00:00Z', '2026-10-15T11:00:00Z');
		expect(result).toMatchObject({ value: 'ever works', conflict: true, loser: '<p>gauzy</p>', loserSide: 'gauzy' });
	});

	it('sets: (S − removed by either) ∪ added by either', () => {
		expect(mergeSets(['a', 'b', 'c'], ['a', 'b', 'd'], ['a', 'c', 'e'])).toEqual(['a', 'd', 'e']);
		const result = mergeField(set, ['a', 'b', 'c'], ['a', 'b', 'd'], ['a', 'c', 'e']);
		expect(result).toMatchObject({ value: ['a', 'd', 'e'], source: 'merged', conflict: false });
		expect(mergeField(set, ['a'], ['b', 'a'], ['a']).value).toEqual(['b', 'a']);
		expect(mergeField(set, ['a', 'b'], ['b', 'a'], ['a', 'b']).source).toBe('none');
	});

	it('treats null and undefined alike, compares dates by instant and objects by value', () => {
		expect(sameValue(null, undefined)).toBe(true);
		expect(sameValue(new Date('2026-10-15T10:00:00Z'), '2026-10-15T10:00:00.000Z')).toBe(true);
		expect(sameValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
		expect(sameValue([1, 2], [2, 1])).toBe(false);
		expect(sameSet(['a', 'b', 'a'], ['b', 'a'])).toBe(true);
	});

	it('merges a record and says which side must apply what (an inbound apply of an echo pushes nothing)', () => {
		const specs = { title: scalar, description: rich, tags: set };
		const snapshot = { title: 'T', description: 'd', tags: ['x'] };
		const echo = mergeRecord(specs, snapshot, snapshot, { ...snapshot });
		expect(echo.toGauzy).toEqual([]);
		expect(echo.toEverWorks).toEqual([]);
		const result = mergeRecord(
			specs,
			snapshot,
			{ title: 'T (gauzy)', description: 'd', tags: ['x', 'g'] },
			{ title: 'T', description: 'd2', tags: ['e'] },
			{ gauzyAt: '2026-10-15T10:00:00Z', everWorksAt: '2026-10-15T09:00:00Z' }
		);
		expect(result.merged).toEqual({ title: 'T (gauzy)', description: 'd2', tags: ['g', 'e'] });
		expect(result.conflicts).toEqual([]);
		expect(result.toGauzy.sort()).toEqual(['description', 'tags']);
		expect(result.toEverWorks.sort()).toEqual(['tags', 'title']);
	});
});
