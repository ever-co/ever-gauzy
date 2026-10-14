/**
 * `DELETE /payment-collections/:id` and `DELETE /payment-webhook-events/:id` retire the row, on both ORMs, against
 * real SQLite.
 *
 * Both routes reached the CRUD base's hard delete. A collection is the money side of an order — `13` §11.4 names it
 * in its "Soft delete only (`deletedAt`); no hard delete through the API" row, and its entity says it "is never
 * hard-deleted while a payment" points at it — and the callback log is the evidence a dispute is argued with, kept
 * "before anything is done with it". Each route now retires the row exactly as its `DELETE /:id/soft` sibling does,
 * through the service's scoped `softRemove`, so `PUT /:id/recover` brings it back.
 *
 * **What is real here.** The controllers and the services are the package's own; the CRUD base below the services
 * is the kernel's own `CrudService`, taken from its module; the repositories are a TypeORM repository over an
 * in-memory better-sqlite3 database and the kernel's `MikroOrmBaseEntityRepository` over an in-memory better-sqlite
 * database with the production soft-delete extension — the harness of `payment-scoped-crud.service.spec.ts`, whose
 * reasons (a fixture table rather than the payment entities; `@gauzy/core`'s barrel doubled) apply unchanged. The
 * one thing restated is `CrudController`, in the shape the kernel declares its three routes: `delete` hands the id
 * to the service's `delete`, and the lifecycle pair hands it the rest parameter as the kernel does. So "the row is
 * still there, retired" is read back from the database, not from a double's call log.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities and routes are declared but never mapped or served here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The kernel's own CRUD base: the retirement under test is its code, not a double's.
		CrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/crud.service').CrudService,
		assertCriteriaHasPredicate: jest.requireActual('@gauzy/core/src/lib/core/crud/criteria.helper')
			.assertCriteriaHasPredicate,
		MikroOrmBaseEntityRepository: jest.requireActual(
			'@gauzy/core/src/lib/core/repository/mikro-orm-base-entity.repository'
		).MikroOrmBaseEntityRepository,
		// The three routes the kernel's `CrudController` declares, in the shape it declares them.
		CrudController: class CrudController {
			constructor(protected readonly crudService: any) {}

			async delete(id: any): Promise<any> {
				return this.crudService.delete(id);
			}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRecover(id, options);
			}
		},
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentUser: () => null,
			currentUserId: () => null,
			hasPermission: () => false
		},
		// `@UsePipes` validates what it is handed: a pipe is an object with `transform`.
		AbstractValidationPipe: class AbstractValidationPipe {
			transform(value: unknown) {
				return value;
			}
		},
		BaseQueryDTO: class BaseQueryDTO {},
		Idempotent: decorator,
		Permissions: decorator,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		TenantOrganizationBaseDTO: class TenantOrganizationBaseDTO {},
		UseValidationPipe: decorator,
		UUIDValidationPipe: class UUIDValidationPipe {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		readAffectedRows: () => 0
	};
});

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { Column, DataSource, DeleteDateColumn, Entity as TypeOrmEntity, PrimaryColumn, Repository } from 'typeorm';
import { Entity as MikroEntity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { CrudService, MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentCollectionController } from './payment-collection/payment-collection.controller';
import { PaymentCollectionService } from './payment-collection/payment-collection.service';
import { PaymentWebhookEventController } from './payment-webhook-event/payment-webhook-event.controller';
import { PaymentWebhookEventService } from './payment-webhook-event/payment-webhook-event.service';

/** The caller the request context answers with; each case states it. */
let mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORGANIZATION_A = '00000000-0000-4000-8000-0000000000a1';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ORGANIZATION_B = '00000000-0000-4000-8000-0000000000b1';

/** The caller's own row, and one of another tenant. */
const OWN = '00000000-0000-4000-8000-000000000001';
const FOREIGN_TENANT = '00000000-0000-4000-8000-000000000002';

/** The one table both services act on here: an identifier, the two scope columns and a deletion date. */
@SoftDeletable(() => RetirableRow, 'deletedAt', () => new Date())
@TypeOrmEntity('payment_delete_fixture')
@MikroEntity({ tableName: 'payment_delete_fixture' })
class RetirableRow {
	@PrimaryColumn({ type: 'varchar' })
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Column({ type: 'varchar' })
	@Property({ type: 'string' })
	tenantId!: string;

	@Column({ type: 'varchar' })
	@Property({ type: 'string' })
	organizationId!: string;

	@DeleteDateColumn({ nullable: true })
	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

const SEED: RetirableRow[] = [
	{ id: OWN, tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: FOREIGN_TENANT, tenantId: TENANT_B, organizationId: ORGANIZATION_B, deletedAt: null }
];

/** A route under test: the controller, built over the real service. */
type Surface = { delete(id: string): Promise<any>; softRecover(id: string, ...options: any[]): Promise<any> };

const CONTROLLERS: ReadonlyArray<{ route: string; build: (typeOrm: unknown, mikroOrm: unknown) => Surface }> = [
	{
		route: 'payment-collections',
		build: (t, m) =>
			new PaymentCollectionController(new PaymentCollectionService(t as never, m as never)) as unknown as Surface
	},
	{
		route: 'payment-webhook-events',
		build: (t, m) =>
			new PaymentWebhookEventController(
				new PaymentWebhookEventService(t as never, m as never, {} as never)
			) as unknown as Surface
	}
];

const ORMS = ['typeorm', 'mikro-orm'] as const;

type Orm = (typeof ORMS)[number];

describe('DELETE /:id of the payment collection and the callback log retires the row and never erases it', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<RetirableRow>;
	let orm: MikroORM<BetterSqliteDriver>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RetirableRow],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		typeOrmRows = dataSource.getRepository(RetirableRow);

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [RetirableRow],
			extensions: [SoftDeleteHandler],
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.schema.createSchema();
	});

	afterAll(async () => {
		await dataSource?.destroy();
		await orm?.close(true);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * Seeds both databases, selects one ORM branch and signs the caller in to tenant A, organization A1.
	 *
	 * @param ormType The branch of the kernel's CRUD base to run.
	 * @returns The two repositories the services are built over, and a reader of one row as stored.
	 */
	async function arrange(ormType: Orm): Promise<{
		typeOrm: Repository<RetirableRow>;
		mikroOrm: unknown;
		stored: (id: string) => Promise<RetirableRow | null>;
	}> {
		await typeOrmRows.clear();
		await typeOrmRows.save(SEED.map((row) => ({ ...row })));

		await orm.em.getConnection().execute('DELETE FROM payment_delete_fixture');
		const em = orm.em.fork();
		for (const row of SEED) {
			em.persist(em.create(RetirableRow, { ...row }));
		}
		await em.flush();

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType as never);
		mockCaller.tenantId = TENANT_A;
		mockCaller.organizationId = ORGANIZATION_A;

		return {
			typeOrm: typeOrmRows,
			mikroOrm: new MikroOrmBaseEntityRepository<RetirableRow>(orm.em.fork(), RetirableRow),
			// Read with retired rows included and outside any scope, so the assertion sees what is stored.
			stored: async (id: string) =>
				ormType === 'typeorm'
					? typeOrmRows.findOne({ where: { id }, withDeleted: true })
					: orm.em.fork().findOne(RetirableRow, { id }, { filters: false })
		};
	}

	describe.each(ORMS)('on the %s branch', (ormType) => {
		describe.each(CONTROLLERS)('DELETE /$route/:id', ({ build }) => {
			it('leaves the row stored with deletedAt set, and PUT /:id/recover brings it back', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const controller = build(typeOrm, mikroOrm);

				const answer = await controller.delete(OWN);

				// Retired, not erased: the row is still in the table, with its deletion date.
				expect(await stored(OWN)).toMatchObject({ id: OWN });
				expect((await stored(OWN))?.deletedAt).toBeTruthy();
				// The route answers with the retired row, as `DELETE /:id/soft` does.
				expect(answer).toMatchObject({ id: OWN });

				await expect(controller.softRecover(OWN)).resolves.toMatchObject({ id: OWN });

				expect((await stored(OWN))?.deletedAt ?? null).toBeNull();
			});

			it('answers not found for a row of another tenant, and leaves it untouched', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const controller = build(typeOrm, mikroOrm);

				await expect(controller.delete(FOREIGN_TENANT)).rejects.toThrow(NotFoundException);

				expect(await stored(FOREIGN_TENANT)).toMatchObject({ id: FOREIGN_TENANT });
				expect((await stored(FOREIGN_TENANT))?.deletedAt ?? null).toBeNull();
			});
		});
	});
});
