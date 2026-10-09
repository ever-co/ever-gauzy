import '../entities/internal';

import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * `PUT /:id/recover`, one of the five routes every `CrudController` subclass inherits, could never
 * recover anything: `softRecover()` looked the row up through `findOneByIdString()` WITHOUT
 * `withDeleted`, and a soft-deleted row is invisible to that lookup — the route answered 404 for the
 * very row it exists to restore. Found while gating those inherited routes for GHSA-v79w-54p2-wmh5.
 *
 * The inherited routes also forward their `...options` rest parameter, which Nest fills with an empty
 * ARRAY, so `softRemove(id, [])` must not treat it as find options either.
 */

const RowSchema = new EntitySchema({
	name: 'Row',
	tableName: 'row',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		name: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', deleteDate: true, nullable: true }
	}
});

class RowService extends CrudService<any> {
	constructor(repository: Repository<any>) {
		super(repository as any, {} as any);
	}
}

describe('CrudService soft delete and recover', () => {
	let dataSource: DataSource;
	let rows: Repository<any>;
	let service: RowService;
	let id: string;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RowSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		rows = dataSource.getRepository('Row');
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await rows.createQueryBuilder().delete().execute();
		const row = await rows.save({ name: 'a row', tenantId: null });
		id = row.id;

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		service = new RowService(rows);
	});

	afterEach(() => jest.restoreAllMocks());

	it('soft-deletes through the inherited route shape, where options is an empty array', async () => {
		await expect(service.softRemove(id, [] as any)).resolves.toMatchObject({ id });

		expect(await rows.findOne({ where: { id } })).toBeNull();
		expect(await rows.findOne({ where: { id }, withDeleted: true })).toMatchObject({ id });
	});

	it('recovers a soft-deleted row through that same route shape', async () => {
		await service.softRemove(id, [] as any);

		await expect(service.softRecover(id, [] as any)).resolves.toMatchObject({ id });

		expect(await rows.findOne({ where: { id } })).toMatchObject({ id, deletedAt: null });
	});

	it('CONTROL: the pre-fix lookup cannot see the soft-deleted row at all', async () => {
		await service.softRemove(id, [] as any);

		// This is what `softRecover` used to call: no `withDeleted`, so the row it is meant to restore is
		// invisible and the route answered 404.
		await expect(service.findOneByIdString(id)).rejects.toThrow(NotFoundException);
		// With the option the fix adds, the same lookup finds it.
		await expect(service.findOneByIdString(id, { withDeleted: true } as any)).resolves.toMatchObject({ id });
	});

	it('keeps honouring the find options a service passes explicitly', async () => {
		await service.softRemove(id, [] as any);

		// A caller-supplied `where` still narrows the lookup, so a scoped recover stays scoped.
		await expect(service.softRecover(id, { where: { tenantId: 'another-tenant' } } as any)).rejects.toThrow(
			NotFoundException
		);
		await expect(service.softRecover(id, { where: { tenantId: null } } as any)).resolves.toMatchObject({ id });
	});
});
