import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeleteHandler, SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { MultiORMEnum, getORMType } from '../../utils';
import { OrmConformanceFixture } from './orm-conformance-fixture.entity';

/**
 * MikroORM's `@PrimaryKey({ type: 'uuid' })` (unlike TypeORM's `@PrimaryGeneratedColumn('uuid')`)
 * has no generator wired up, so it requires the id up front — a real behavioral difference between
 * the two ORMs, but one about id generation, not what this suite is scoped to (pagination/ordering/
 * tenant filtering/soft delete). Both adapters generate the id explicitly so seeded rows are
 * comparable either way.
 */
const withId = <T extends { id?: string }>(row: T): T & { id: string } => ({ id: randomUUID(), ...row });

export interface IConformanceRow {
	id: string;
	tenantId: string;
	organizationId: string;
	name: string;
	sortOrder?: number;
	deletedAt?: Date | null;
}

export interface IPaginateParams {
	tenantId: string;
	skip: number;
	take: number;
	orderBy: 'name' | 'sortOrder';
	direction: 'ASC' | 'DESC';
}

/**
 * The ORM-agnostic surface the conformance suite (`orm-conformance.spec.ts`) tests against. Each
 * ORM gets its own adapter implementation below; the suite's assertions are written once and run
 * unchanged against whichever adapter matches the process's `DB_ORM` (see the suite file for why
 * this is a *process*-level choice, not a per-test one).
 */
export interface IOrmConformanceAdapter {
	seed(rows: Array<Partial<IConformanceRow>>): Promise<IConformanceRow[]>;
	paginate(params: IPaginateParams): Promise<{ items: IConformanceRow[]; total: number }>;
	findAllByTenant(tenantId: string): Promise<IConformanceRow[]>;
	softDelete(id: string): Promise<void>;
	findIncludingDeleted(tenantId: string): Promise<IConformanceRow[]>;
	close(): Promise<void>;
}

/** Builds the adapter for whichever ORM is active for THIS process (see `getORMType()`). */
export async function createAdapterForCurrentOrm(): Promise<IOrmConformanceAdapter> {
	switch (getORMType()) {
		case MultiORMEnum.MikroORM:
			return createMikroOrmAdapter();
		case MultiORMEnum.TypeORM:
		default:
			return createTypeOrmAdapter();
	}
}

async function createTypeOrmAdapter(): Promise<IOrmConformanceAdapter> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		dropSchema: true,
		synchronize: true,
		entities: [OrmConformanceFixture]
	});
	await dataSource.initialize();
	const repository = dataSource.getRepository(OrmConformanceFixture);

	return {
		async seed(rows) {
			return await repository.save(rows.map((row) => repository.create(withId(row))));
		},
		async paginate({ tenantId, skip, take, orderBy, direction }) {
			const [items, total] = await repository.findAndCount({
				where: { tenantId },
				order: { [orderBy]: direction },
				skip,
				take
			});
			return { items, total };
		},
		async findAllByTenant(tenantId) {
			return await repository.find({ where: { tenantId } });
		},
		async softDelete(id) {
			await repository.softDelete(id);
		},
		async findIncludingDeleted(tenantId) {
			return await repository.find({ where: { tenantId }, withDeleted: true });
		},
		async close() {
			await dataSource.destroy();
		}
	};
}

async function createMikroOrmAdapter(): Promise<IOrmConformanceAdapter> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [OrmConformanceFixture],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.getSchemaGenerator().createSchema();
	const em = orm.em.fork();

	return {
		async seed(rows) {
			const entities = rows.map((row) => em.create(OrmConformanceFixture, withId(row) as OrmConformanceFixture));
			await em.persistAndFlush(entities);
			return entities;
		},
		async paginate({ tenantId, skip, take, orderBy, direction }) {
			const [items, total] = await em.findAndCount(
				OrmConformanceFixture,
				{ tenantId },
				{ orderBy: { [orderBy]: direction.toLowerCase() } as any, offset: skip, limit: take }
			);
			return { items, total };
		},
		async findAllByTenant(tenantId) {
			return await em.find(OrmConformanceFixture, { tenantId });
		},
		async softDelete(id) {
			// The `mikro-orm-soft-delete` extension turns this into an UPDATE ... SET deletedAt = now(),
			// not a real DELETE — the same substitution TypeORM's `softDelete()` performs natively.
			const row = await em.findOneOrFail(OrmConformanceFixture, { id });
			em.remove(row);
			await em.flush();
		},
		async findIncludingDeleted(tenantId) {
			return await em.find(OrmConformanceFixture, { tenantId }, { filters: { [SOFT_DELETABLE_FILTER]: false } });
		},
		async close() {
			await orm.close(true);
		}
	};
}
