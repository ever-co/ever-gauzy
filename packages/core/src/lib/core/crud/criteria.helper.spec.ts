import { BadRequestException } from '@nestjs/common';
import { DataSource, EntitySchema, In, IsNull, Repository } from 'typeorm';
import { assertCriteriaHasPredicate } from './criteria.helper';

/**
 * TypeORM refuses `{}` for update/delete but not `{ key: undefined }` — and an undefined where value
 * is (and must stay) omitted from the SQL, so that shape produced an UNFILTERED DELETE / UPDATE.
 * The guard closes it; the DataSource half of this suite proves the shape really is a full-table
 * statement, so the guard is known to be load-bearing rather than theoretical.
 */
describe('assertCriteriaHasPredicate', () => {
	it.each([
		['undefined', undefined],
		['null', null],
		['empty string', ''],
		['an object whose only value is undefined', { employeeId: undefined }],
		['an object whose values are all undefined', { employeeId: undefined, organizationId: undefined }],
		['a nested relation criteria whose leaves are all undefined', { employee: { id: undefined } }],
		['a nested embedded criteria with an empty object', { members: {} }],
		['an OR-array whose branches carry no predicate', [{ id: undefined }, { employee: { id: undefined } }]],
		['an empty object', {}]
	])('rejects %s', (_label, criteria) => {
		expect(() => assertCriteriaHasPredicate(criteria, 'delete')).toThrow(BadRequestException);
	});

	it.each([
		['an id string', 'a1b2'],
		['an id number', 42],
		['a where with one defined value', { employeeId: 'emp', organizationId: undefined }],
		['a null value (a real IS NULL predicate)', { organizationId: null }],
		['a find operator', { id: In(['a', 'b']) }],
		['an IsNull() operator', { deletedAt: IsNull() }],
		['a nested relation criteria with a real leaf', { employee: { id: 'emp' }, organizationId: undefined }],
		['an OR-array with one usable branch', [{ id: undefined }, { employeeId: 'emp' }]],
		['an array of ids', ['a', 'b']]
	])('accepts %s', (_label, criteria) => {
		expect(() => assertCriteriaHasPredicate(criteria, 'delete')).not.toThrow();
	});
});

describe('why the guard exists — an all-undefined criteria object (TypeORM 1.0 ran it unfiltered)', () => {
	const RowSchema = new EntitySchema({
		name: 'Row',
		tableName: 'row',
		columns: {
			id: { primary: true, type: 'varchar', generated: 'uuid' },
			employeeId: { type: 'varchar', nullable: true },
			flag: { type: 'boolean', default: false }
		}
	});
	let dataSource: DataSource;
	let rows: Repository<any>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RowSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		rows = dataSource.getRepository('Row');
	});
	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});
	beforeEach(async () => {
		await rows.clear();
		await rows.save([{ employeeId: 'a' }, { employeeId: 'b' }, { employeeId: null }]);
	});

	// TypeORM 1.0 ran these with no WHERE at all: the delete wiped the table and the update touched every row,
	// which is what the guard was written against. TypeORM 1.1 refuses empty criteria for both itself, so the
	// controls now pin that refusal (and that nothing was written); the guard stays, so a caller learns which
	// criterion was missing, and so a dependency that relaxes this again cannot reopen the hole.
	it('CONTROL: repository.delete({ employeeId: undefined }) has no criterion left (TypeORM >= 1.1 refuses it)', async () => {
		await expect(rows.delete({ employeeId: undefined })).rejects.toThrow(/Empty criteria/);
		expect(await rows.count()).toBe(3);
	});

	it('CONTROL: repository.update({ employeeId: undefined }, ...) has no criterion left (TypeORM >= 1.1 refuses it)', async () => {
		await expect(rows.update({ employeeId: undefined }, { flag: true })).rejects.toThrow(/Empty criteria/);
		expect(await rows.countBy({ flag: true })).toBe(0);
	});

	it('a null value is a real predicate (IS NULL) under the shipped setting', async () => {
		const { affected } = await rows.delete({ employeeId: null });
		expect(affected).toBe(1);
		expect(await rows.count()).toBe(2);
	});
});
