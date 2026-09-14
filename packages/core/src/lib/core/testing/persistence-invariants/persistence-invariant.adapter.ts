import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { EntityCaseNamingStrategy, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { MultiORMEnum, getORMType } from '../../utils';
import { MikroOrmBaseEntityRepository } from '../../repository/mikro-orm-base-entity.repository';
import { PersistenceInvariantFixture } from './persistence-invariant-fixture.entity';
import { PersistenceInvariantTenant } from './persistence-invariant-tenant.entity';
import { PersistenceInvariantService } from './persistence-invariant.service';

/**
 * `tenantId` carries `relationId: true` (mirroring `TenantBaseEntity`), which both ORMs treat as a
 * computed/non-persisted mirror of the `tenant` relation (TypeORM: `@RelationId`; MikroORM:
 * `persist: false`, see `column.helper.ts`) — setting it directly on an insert is silently dropped
 * by both. A seed helper that only set `tenantId` produced rows whose real `tenantId` column stayed
 * NULL, so `assertCanReadOwnTenant` failed even for a matching tenant. Route it through the `tenant`
 * relation instead, exactly as `TenantAwareCrudService.create()` itself does.
 */
function splitTenantRelation(row: Partial<PersistenceInvariantFixture>) {
	const { tenantId, ...rest } = row;
	return { rest, tenantId };
}

export interface IPersistenceInvariantHarness {
	service: PersistenceInvariantService;
	/** Test-only: insert a row directly against the real DB, bypassing the service under test —
	 *  this is how a test plants "another tenant's" row without trusting the code being verified. */
	seed(row: Partial<PersistenceInvariantFixture>): Promise<PersistenceInvariantFixture>;
	/** Test-only: read a row back directly, bypassing tenant scoping, to check post-conditions. */
	exists(id: string): Promise<boolean>;
	close(): Promise<void>;
}

/**
 * Builds a `PersistenceInvariantService` backed by a REAL, freshly-created in-memory SQLite
 * database, using whichever ORM is active for THIS process (see `getORMType()` — and the
 * `orm-conformance` folder's README for why that's a process-wide, not per-call, choice). This is
 * the piece that upgrades TASK 1's tenant-isolation assertions from running against an in-memory
 * fake repository to running against real SQL, under either ORM.
 */
export async function createPersistenceInvariantHarness(): Promise<IPersistenceInvariantHarness> {
	switch (getORMType()) {
		case MultiORMEnum.MikroORM:
			return createMikroOrmHarness();
		case MultiORMEnum.TypeORM:
		default:
			return createTypeOrmHarness();
	}
}

async function createTypeOrmHarness(): Promise<IPersistenceInvariantHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		dropSchema: true,
		synchronize: true,
		entities: [PersistenceInvariantFixture, PersistenceInvariantTenant]
	});
	await dataSource.initialize();
	const repository = dataSource.getRepository(PersistenceInvariantFixture);
	const tenantRepository = dataSource.getRepository(PersistenceInvariantTenant);

	// The MikroORM side of the constructor is never invoked while this process's ormType is
	// TypeORM (see CrudService's `ormType` switch) — an inert stand-in is enough, same as TASK 1.
	const service = new PersistenceInvariantService(repository, {} as unknown as MikroOrmBaseEntityRepository<PersistenceInvariantFixture>);

	return {
		service,
		async seed(row) {
			const { rest, tenantId } = splitTenantRelation(row);
			// `save()` upserts on the primary key, so re-seeding the same tenant id across multiple
			// rows/tests is safe.
			if (tenantId) {
				await tenantRepository.save({ id: tenantId });
			}
			return await repository.save(
				repository.create({
					id: randomUUID(),
					...rest,
					...(tenantId ? { tenant: { id: tenantId } as PersistenceInvariantTenant } : {})
				})
			);
		},
		async exists(id) {
			return (await repository.findOne({ where: { id }, withDeleted: true })) !== null;
		},
		async close() {
			await dataSource.destroy();
		}
	};
}

async function createMikroOrmHarness(): Promise<IPersistenceInvariantHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [PersistenceInvariantFixture, PersistenceInvariantTenant],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false },
		// Matches packages/config/src/lib/database.ts's own MikroORM config exactly — without it, a
		// `@MultiORMManyToOne` relation's explicitly-named join column and its `@RelationId` mirror
		// column land on two different physical columns under MikroORM's default naming strategy (see
		// the long comment on `PersistenceInvariantFixture.tenant`).
		namingStrategy: EntityCaseNamingStrategy
	});
	await orm.getSchemaGenerator().createSchema();
	const em = orm.em.fork();
	const mikroOrmRepository = new MikroOrmBaseEntityRepository<PersistenceInvariantFixture>(em, PersistenceInvariantFixture);

	// `TenantAwareCrudService` reads `this.typeOrmRepository.metadata.hasColumnWithPropertyPath(...)`
	// UNCONDITIONALLY — regardless of which ORM actually executes the query — to decide whether an
	// entity is tenant/employee scoped at all (see its `findConditionsWithTenantByUser`/
	// `findConditionsWithEmployeeByUser`). So even in the MikroORM harness, this stand-in must answer
	// that check correctly for the real columns (`tenantId`), not just return `true` unconditionally.
	const service = new PersistenceInvariantService(
		{ metadata: { hasColumnWithPropertyPath: (path: string) => path === 'tenantId' } } as any,
		mikroOrmRepository
	);

	return {
		service,
		async seed(row) {
			const { rest, tenantId } = splitTenantRelation(row);
			if (tenantId) {
				await em.upsert(PersistenceInvariantTenant, { id: tenantId });
			}
			const entity = em.create(PersistenceInvariantFixture, {
				id: randomUUID(),
				...rest,
				...(tenantId ? { tenant: em.getReference(PersistenceInvariantTenant, tenantId) } : {})
			} as PersistenceInvariantFixture);
			await em.persistAndFlush(entity);
			return entity;
		},
		async exists(id) {
			return (
				(await em.findOne(PersistenceInvariantFixture, { id } as any, { filters: false })) !== null
			);
		},
		async close() {
			await orm.close(true);
		}
	};
}
