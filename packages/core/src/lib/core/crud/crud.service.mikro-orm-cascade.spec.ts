import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * Under MikroORM the CRUD base writes the new rows of a to-many relation only where TypeORM would, and a failed
 * write does not linger in the request's unit of work.
 *
 * TypeORM ignores a new (keyless) row of a to-many relation that does not cascade inserts, and callers rely on it:
 * `FulfillmentService.create` hands the base the fulfilment with its `lines` and creates each line itself. MikroORM
 * persists new rows by default, so every line was inserted twice and the second insert broke the table's unique
 * index; the failed statement then stayed in the unit of work, and the idempotency interceptor's next flush failed
 * with it. The store here is MikroORM on in-memory better-sqlite3; TypeORM's view of the relation is the metadata
 * `findRelationWithPropertyPath` answers, as TypeORM builds it from the platform's mapping.
 */

class SpecShipment {
	id!: string;
	name?: string;
	lines?: unknown;
}

class SpecLine {
	id!: string;
	label?: string;
	shipment?: unknown;
}

const schemas = [
	new EntitySchema<SpecShipment>({
		class: SpecShipment,
		tableName: 'spec_shipment',
		properties: {
			id: {
				type: 'uuid',
				primary: true,
				onCreate: (row: SpecShipment) => row.id ?? require('node:crypto').randomUUID()
			},
			name: { type: 'string', nullable: true },
			lines: { kind: '1:m', entity: () => SpecLine, mappedBy: 'shipment' } as any
		}
	}),
	new EntitySchema<SpecLine>({
		class: SpecLine,
		tableName: 'spec_line',
		properties: {
			id: {
				type: 'uuid',
				primary: true,
				onCreate: (row: SpecLine) => row.id ?? require('node:crypto').randomUUID()
			},
			label: { type: 'string', nullable: true },
			shipment: { kind: 'm:1', entity: () => SpecShipment, nullable: true, joinColumn: 'shipmentId' } as any
		}
	})
];

class ShipmentService extends CrudService<any> {
	constructor(cascadesInsert: boolean, mikroOrmRepository: unknown) {
		super(
			{ metadata: { findRelationWithPropertyPath: () => ({ isCascadeInsert: cascadesInsert }) } } as any,
			mikroOrmRepository as any
		);
	}
}

describe('CrudService writes to-many rows as TypeORM does under MikroORM', () => {
	let orm: MikroORM<BetterSqliteDriver>;

	const service = (cascadesInsert: boolean, em = orm.em.fork()) =>
		new ShipmentService(cascadesInsert, new MikroOrmBaseEntityRepository<SpecShipment>(em as any, SpecShipment));
	const labelsOf = async (shipmentId: string): Promise<string[]> => {
		const rows: any[] = await orm.em
			.getConnection()
			.execute('SELECT label FROM spec_line WHERE shipmentId = ? ORDER BY label', [shipmentId]);
		return rows.map((row) => row.label);
	};

	beforeAll(async () => {
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: schemas,
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
		await orm.schema.createSchema();
		await orm.em.getConnection().execute('CREATE UNIQUE INDEX uq_spec_line ON spec_line (shipmentId, label)');
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('leaves out the new rows of a relation that does not cascade inserts, so the caller can create them once', async () => {
		const shipment = await service(false).create({
			name: 'without cascade',
			lines: [{ label: 'a' }, { label: 'b' }]
		});
		expect(await labelsOf(shipment.id)).toEqual([]);

		// What FulfillmentService does next: each line created on its own, once.
		const lineRepository = new MikroOrmBaseEntityRepository<SpecLine>(orm.em.fork() as any, SpecLine);
		for (const label of ['a', 'b']) {
			await new ShipmentService(false, lineRepository).create({ label, shipment: shipment.id } as any);
		}
		expect(await labelsOf(shipment.id)).toEqual(['a', 'b']);
	});

	it('writes the new rows of a relation that cascades inserts', async () => {
		const shipment = await service(true).create({ name: 'with cascade', lines: [{ label: 'c' }] });

		expect(await labelsOf(shipment.id)).toEqual(['c']);
	});

	it('still links a stored row the payload names by its key', async () => {
		await orm.em
			.getConnection()
			.execute(`INSERT INTO spec_line (id, label) VALUES ('d0000000-0000-4000-8000-00000000000d', 'd')`);

		const shipment = await service(false).create({
			name: 'linking',
			lines: [{ id: 'd0000000-0000-4000-8000-00000000000d' }, { label: 'new, left out' }]
		});

		expect(await labelsOf(shipment.id)).toEqual(['d']);
	});

	it('forgets a failed write, so the next flush in the same context does not retry it', async () => {
		const em = orm.em.fork();
		const shipment = await service(true, em).create({ name: 'duplicate lines', lines: [{ label: 'e' }] });

		// The same line again breaks the unique index...
		await expect(
			new ShipmentService(true, new MikroOrmBaseEntityRepository<SpecLine>(em as any, SpecLine)).create({
				label: 'e',
				shipment: shipment.id
			} as any)
		).rejects.toThrow('A record with these values already exists');

		// ...and a later, unrelated write in the same context succeeds instead of failing with it.
		const other = await service(true, em).create({ name: 'after the failure' });
		expect(other.id).toBeDefined();
	});
});
