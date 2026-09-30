import { splitKeywords } from './utils';

/**
 * With `split(' ')`, "John " (typed while entering a full name) gave ['John', ''], and the empty keyword
 * became `LIKE '%%'`, OR-ed in, so the search returned every row.
 */
describe('splitKeywords', () => {
	it('splits on any whitespace and drops empty keywords', () => {
		expect(splitKeywords('  Ada   Love ')).toEqual(['Ada', 'Love']);
		expect(splitKeywords('John ')).toEqual(['John']);
		expect(splitKeywords('Ada\tLove')).toEqual(['Ada', 'Love']);
	});

	it.each([
		['an empty string', ''],
		['only spaces', '   '],
		['null', null],
		['undefined', undefined]
	])('returns no keyword for %s', (_label, value) => {
		expect(splitKeywords(value)).toEqual([]);
	});

	it('accepts a number, which the query DTO produces for a numeric search', () => {
		expect(splitKeywords(123)).toEqual(['123']);
	});
});
