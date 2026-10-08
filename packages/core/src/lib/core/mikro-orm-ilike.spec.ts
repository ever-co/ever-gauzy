import { mikroOrmContains, mikroOrmILike } from './utils';

/**
 * MikroORM emits `$ilike` verbatim as `ILIKE`, which MySQL and SQLite reject.
 */
describe('mikroOrmILike', () => {
	it('keeps the pattern as is and uses $ilike on PostgreSQL', () => {
		expect(mikroOrmILike('abc%', true)).toEqual({ $ilike: 'abc%' });
		expect(mikroOrmILike('travel', true)).toEqual({ $ilike: 'travel' });
	});

	it('uses $like on MySQL / SQLite', () => {
		expect(mikroOrmILike('abc%', false)).toEqual({ $like: 'abc%' });
	});

	it('matches mikroOrmContains for a "contains" pattern', () => {
		expect(mikroOrmILike('%Ada%', true)).toEqual(mikroOrmContains('Ada', true));
		expect(mikroOrmILike('%Ada%', false)).toEqual(mikroOrmContains('Ada', false));
	});
});
