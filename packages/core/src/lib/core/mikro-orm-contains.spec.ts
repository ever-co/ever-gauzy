import { mikroOrmContains } from './utils';

/**
 * MikroORM emits `$ilike` verbatim as `ILIKE`, which MySQL and SQLite reject.
 */
describe('mikroOrmContains', () => {
	it('uses $ilike on PostgreSQL', () => {
		expect(mikroOrmContains('Ada', true)).toEqual({ $ilike: '%Ada%' });
	});

	it('uses $like on MySQL / SQLite, whose LIKE is already case-insensitive', () => {
		expect(mikroOrmContains('Ada', false)).toEqual({ $like: '%Ada%' });
	});
});
