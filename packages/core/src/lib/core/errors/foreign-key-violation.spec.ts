import { QueryFailedError } from 'typeorm';
import { isForeignKeyViolation } from './foreign-key-violation';

describe('isForeignKeyViolation', () => {
	it.each([
		[
			'a postgres error',
			{ code: '23503', message: 'update or delete on table "employee" violates foreign key constraint' }
		],
		['a mysql parent row still referenced', { code: 'ER_ROW_IS_REFERENCED_2', errno: 1451 }],
		['a mysql missing parent row', { code: 'ER_NO_REFERENCED_ROW_2', errno: 1452 }],
		['a sqlite error', { code: 'SQLITE_CONSTRAINT_FOREIGNKEY', message: 'FOREIGN KEY constraint failed' }],
		['a wrapped driver error', { driverError: { code: '23503' } }],
		['a message without a code', new Error('Cannot delete or update a parent row: a foreign key constraint fails')]
	])('recognizes %s', (_case, error) => {
		expect(isForeignKeyViolation(error)).toBe(true);
	});

	it('recognizes a TypeORM QueryFailedError over a postgres error', () => {
		const driverError = Object.assign(new Error('violates foreign key constraint "FK_x" on table "key_result"'), {
			code: '23503'
		});

		expect(isForeignKeyViolation(new QueryFailedError('DELETE FROM "organization"', [], driverError))).toBe(true);
	});

	it.each([
		['a unique violation', { code: '23505', message: 'duplicate key value violates unique constraint' }],
		['a missing record', new Error('The record was not found')],
		['nothing', undefined],
		['a string', 'violates foreign key constraint']
	])('leaves out %s', (_case, error) => {
		expect(isForeignKeyViolation(error)).toBe(false);
	});
});
