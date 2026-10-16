import { DataSource, EntitySchema, Repository } from 'typeorm';
import { MultiORMEnum } from '../utils';
import { CrudController } from './crud.controller';
import { CrudService } from './crud.service';

/**
 * An update with nothing left to write (CodeRabbit on #10647).
 *
 * The inherited `PUT /:id` now drops `id`, `deletedAt`, `tenantId` and `tenant` from the body, so a body carrying only
 * those reaches the service as an empty patch. `TenantAwareCrudService` answers that with a zero-affected result after
 * its existence check; a plain `CrudService` handed it to TypeORM, whose empty `SET` raises `UpdateValuesMissingError`
 * — a 400 for a request that asked for nothing. It now answers the same zero-affected result, which is also what it
 * answers for an id that matches no row, so the missing-id behaviour is unchanged.
 *
 * A real SQLite table under the plain service.
 */

const RowSchema = new EntitySchema<any>({
	name: 'PlainRow',
	tableName: 'plain_row',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true }
	}
});

class PlainRowService extends CrudService<any> {
	constructor(typeOrmRepository: Repository<any>) {
		super(typeOrmRepository, {} as any);
	}
}

class PlainRowController extends CrudController<any> {
	constructor(service: PlainRowService) {
		super(service);
	}
}

describe('CrudService.update — an empty patch is a no-op, not a 400', () => {
	let dataSource: DataSource;
	let rows: Repository<any>;
	let service: PlainRowService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RowSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		rows = dataSource.getRepository('PlainRow');
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	beforeEach(async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		await rows.clear();
		await rows.save({ id: 'r1', name: 'first', tenantId: 'tenant-a' });
		service = new PlainRowService(rows);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers zero affected rows for an empty patch, and writes nothing', async () => {
		// The failure scenario: `UpdateValuesMissingError` → BadRequestException.
		await expect(service.update('r1', {})).resolves.toEqual({ generatedMaps: [], raw: [], affected: 0 });
		expect(await rows.findOneBy({ id: 'r1' })).toMatchObject({ name: 'first', tenantId: 'tenant-a' });
	});

	it('answers a body of only the members a PUT never writes the same way, through the inherited route', async () => {
		const controller = new PlainRowController(service);

		await expect(
			controller.update('r1', { id: 'r2', tenantId: 'tenant-b', tenant: { id: 'tenant-b' }, deletedAt: new Date() } as any)
		).resolves.toEqual({ generatedMaps: [], raw: [], affected: 0 });
		expect(await rows.findOneBy({ id: 'r1' })).toMatchObject({ name: 'first', tenantId: 'tenant-a' });
	});

	it('keeps the missing-id answer: zero affected rows, no error', async () => {
		await expect(service.update('missing', { name: 'x' })).resolves.toMatchObject({ affected: 0 });
	});

	it('still writes a patch that has something in it', async () => {
		await expect(service.update('r1', { name: 'second' })).resolves.toMatchObject({ affected: 1 });
		expect(await rows.findOneBy({ id: 'r1' })).toMatchObject({ name: 'second' });
	});
});
