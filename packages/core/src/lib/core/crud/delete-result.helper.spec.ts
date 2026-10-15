import { answersDeleted } from './delete-result.helper';

describe('answersDeleted', () => {
	it.each([
		['a delete that removed one row', { affected: 1, raw: [] }, true],
		['a bulk delete that removed several rows', { affected: 3, raw: [] }, true],
		['a soft delete whose update reached a row', { affected: 1, raw: [], generatedMaps: [] }, true],
		['a delete that matched nothing', { affected: 0, raw: [] }, false],
		['a result that reports no count', { raw: [] }, false],
		['a result whose count is null', { affected: null, raw: [] }, false],
		['no result at all', undefined, false],
		['a null result', null, false],
		['a row rather than a delete result', { id: 'row-1' }, false]
	])('%s', (_label, result, expected) => {
		expect(answersDeleted(result as object | null | undefined)).toBe(expected);
	});
});
