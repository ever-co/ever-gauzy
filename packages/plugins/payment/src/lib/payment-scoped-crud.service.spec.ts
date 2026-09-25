/**
 * The soft-delete pair and the hard delete of the eight payment services, run for real against a row of
 * another tenant.
 *
 * `DELETE /:id/soft`, `PUT /:id/recover` and the GraphQL `softDelete*` / `recover*` fields that mirror
 * them all reach the service's inherited `softRemove` / `softRecover`. The eight services extend the
 * kernel's plain `CrudService`, whose pair resolves the row through `findOneByIdString` — a read by
 * identifier alone — so a caller who knew the identifier of another tenant's session, capture or refund
 * retired it, restored it and was handed it back in the payload. `DELETE /:id` reached the kernel's
 * `delete` the same way and erased the row outright. The GraphQL suite beside this one
 * (`graphql/soft-delete.spec.ts`) stubs the services, so it could never see the missing scope.
 *
 * **Nothing the defect lives in is doubled here.** The services are the real ones; the CRUD base below
 * them is the kernel's own `CrudService`, taken from its module rather than restated; the repositories
 * are real — a TypeORM repository over an in-memory better-sqlite3 database, and a MikroORM repository
 * (the kernel's own `MikroOrmBaseEntityRepository`) over an in-memory better-sqlite database with the
 * production soft-delete extension (`mikro-orm-soft-delete`'s `SoftDeletable` and `SoftDeleteHandler`,
 * the mechanism `SoftDeletableBaseEntity` uses), so a retired row is filtered out by default and a
 * removal is an `UPDATE … SET deletedAt`, exactly as in production. Each ORM branch of the kernel's pair
 * is selected the way the application selects it — through `CrudService.ormType` — so both branches run
 * against a database: the TypeORM one, and the MikroORM one whose two reads (the guard read, then the
 * repository read whose entity it removes) both have to be scoped.
 *
 * The row is a standalone fixture rather than a payment entity, for the reason the kernel's ORM
 * conformance suite gives: the production base entity carries a Postgres-only identifier default that
 * SQLite rejects. The pair reads nothing of a row but its identifier, its tenant, its organization and
 * its deletion date, so a fixture with exactly those columns is the whole of what the eight services act
 * on here, and one fixture table is shared by all of them.
 *
 * `@gauzy/core`'s barrel is doubled for the reason the package's other service specs state — it boots
 * the whole application graph — and the three members this suite is about are the kernel's own: the
 * CRUD base, the MikroORM repository base, and the request context's two readers, which answer with the
 * caller this suite states.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the payment entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The kernel's own CRUD base: the soft-delete pair under test is its code, not a double's.
		CrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/crud.service').CrudService,
		// The kernel's own guard against a criterion that selects nothing, which the scoped delete runs first.
		assertCriteriaHasPredicate: jest.requireActual('@gauzy/core/src/lib/core/crud/criteria.helper')
			.assertCriteriaHasPredicate,
		MikroOrmBaseEntityRepository: jest.requireActual(
			'@gauzy/core/src/lib/core/repository/mikro-orm-base-entity.repository'
		).MikroOrmBaseEntityRepository,
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentUser: () => null,
			currentUserId: () => null,
			hasPermission: () => false
		},
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
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Column, DataSource, DeleteDateColumn, Entity as TypeOrmEntity, PrimaryColumn, Repository } from 'typeorm';
import { Entity as MikroEntity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { CrudService, MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PaymentCaptureService } from './payment-capture/payment-capture.service';
import { PaymentCollectionService } from './payment-collection/payment-collection.service';
import { PaymentProviderService } from './payment-provider/payment-provider.service';
import { PaymentSessionService } from './payment-session/payment-session.service';
import { PaymentWebhookEventService } from './payment-webhook-event/payment-webhook-event.service';
import { RefundLineService } from './refund-line/refund-line.service';
import { RefundReasonService } from './refund-reason/refund-reason.service';
import { RefundService } from './refund/refund.service';
import { PaymentScopedCrudService } from './payment-scoped-crud.service';

/** The caller the request context answers with; each case states it. */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

/** The caller's tenant and organization. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORGANIZATION_A = '00000000-0000-4000-8000-0000000000a1';

/** Another tenant, and another organization of the caller's own tenant. */
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ORGANIZATION_B = '00000000-0000-4000-8000-0000000000b1';
const ORGANIZATION_A2 = '00000000-0000-4000-8000-0000000000a2';

/** The rows: the caller's own, one of another tenant, and one of another organization of its tenant. */
const OWN = '00000000-0000-4000-8000-000000000001';
const FOREIGN_TENANT = '00000000-0000-4000-8000-000000000002';
const FOREIGN_ORGANIZATION = '00000000-0000-4000-8000-000000000003';

/**
 * The one table every service acts on here: an identifier, the two scope columns and a deletion date,
 * mapped for both ORMs, with the production MikroORM soft-delete mechanism on it.
 */
@SoftDeletable(() => ScopedRow, 'deletedAt', () => new Date())
@TypeOrmEntity('payment_scope_fixture')
@MikroEntity({ tableName: 'payment_scope_fixture' })
class ScopedRow {
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

/** The three rows every case starts from. */
const SEED: ScopedRow[] = [
	{ id: OWN, tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: FOREIGN_TENANT, tenantId: TENANT_B, organizationId: ORGANIZATION_B, deletedAt: null },
	{ id: FOREIGN_ORGANIZATION, tenantId: TENANT_A, organizationId: ORGANIZATION_A2, deletedAt: null }
];

type AnyScoped = PaymentScopedCrudService<any>;

/**
 * The eight services, each built over the two fixture repositories.
 *
 * The collaborators beyond the two repositories are empty objects: the soft-delete pair touches none of
 * them, and one that did would fail here loudly rather than pass on a double's answer.
 */
const SERVICES: ReadonlyArray<{ name: string; build: (typeOrm: unknown, mikroOrm: unknown) => AnyScoped }> = [
	{ name: 'PaymentProviderService', build: (t, m) => new PaymentProviderService(t as never, m as never) },
	{ name: 'PaymentCollectionService', build: (t, m) => new PaymentCollectionService(t as never, m as never) },
	{
		name: 'PaymentSessionService',
		build: (t, m) => new PaymentSessionService(t as never, m as never, {} as never, {} as never, {} as never)
	},
	{
		name: 'PaymentCaptureService',
		build: (t, m) => new PaymentCaptureService(t as never, m as never, {} as never, {} as never, {} as never)
	},
	{
		name: 'RefundService',
		build: (t, m) =>
			new RefundService(t as never, m as never, {} as never, {} as never, {} as never, {} as never, {} as never)
	},
	{ name: 'RefundReasonService', build: (t, m) => new RefundReasonService(t as never, m as never) },
	{ name: 'RefundLineService', build: (t, m) => new RefundLineService(t as never, m as never) },
	{
		name: 'PaymentWebhookEventService',
		build: (t, m) => new PaymentWebhookEventService(t as never, m as never, {} as never)
	}
];

/** The two ORM branches of the kernel's pair, named as `CrudService.ormType` names them. */
const ORMS = ['typeorm', 'mikro-orm'] as const;

type Orm = (typeof ORMS)[number];

describe('PaymentScopedCrudService — the soft-delete pair stays inside the caller’s tenant and organization', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<ScopedRow>;
	let orm: MikroORM<BetterSqliteDriver>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [ScopedRow],
			synchronize: true,
			logging: false,
			// The platform's shipped setting (`TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR`): `null` is `IS NULL`.
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		typeOrmRows = dataSource.getRepository(ScopedRow);

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [ScopedRow],
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
	 * @param ormType The branch of the kernel's pair to run.
	 * @returns The two repositories the services are built over, and a reader of one row as stored.
	 */
	async function arrange(ormType: Orm): Promise<{
		typeOrm: Repository<ScopedRow>;
		mikroOrm: unknown;
		stored: (id: string) => Promise<ScopedRow | null>;
	}> {
		await typeOrmRows.clear();
		await typeOrmRows.save(SEED.map((row) => ({ ...row })));

		await orm.em.getConnection().execute('DELETE FROM payment_scope_fixture');
		const em = orm.em.fork();
		for (const row of SEED) {
			em.persist(em.create(ScopedRow, { ...row }));
		}
		await em.flush();

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType as never);
		mockCaller.tenantId = TENANT_A;
		mockCaller.organizationId = ORGANIZATION_A;

		const mikroOrm = new MikroOrmBaseEntityRepository<ScopedRow>(orm.em.fork(), ScopedRow);

		return {
			typeOrm: typeOrmRows,
			mikroOrm,
			// Read with retired rows included and outside any scope, so the assertion sees what is stored.
			stored: async (id: string) =>
				ormType === 'typeorm'
					? typeOrmRows.findOne({ where: { id }, withDeleted: true })
					: orm.em.fork().findOne(ScopedRow, { id }, { filters: false })
		};
	}

	/** Retires one row directly in the database the branch reads, outside any service. */
	async function retire(ormType: Orm, id: string): Promise<void> {
		if (ormType === 'typeorm') {
			await typeOrmRows.softDelete(id);
			return;
		}

		// The production extension turns this removal into `UPDATE … SET deleted_at`, as it does in the app.
		const em = orm.em.fork();
		em.remove(await em.findOneOrFail(ScopedRow, { id }));
		await em.flush();
	}

	describe.each(ORMS)('on the %s branch', (ormType) => {
		describe.each(SERVICES)('$name', ({ build }) => {
			it('retires the caller’s own row, and answers with it', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				await expect(service.softRemove(OWN)).resolves.toMatchObject({ id: OWN });

				expect((await stored(OWN))?.deletedAt).toBeTruthy();
			});

			it('refuses to retire a row of another tenant, and leaves it live', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				// The failure scenario: a caller in tenant A who knows the identifier of tenant B's row.
				await expect(service.softRemove(FOREIGN_TENANT)).rejects.toThrow(NotFoundException);

				expect((await stored(FOREIGN_TENANT))?.deletedAt ?? null).toBeNull();
			});

			it('refuses to retire a row of another organization of the caller’s own tenant', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				await expect(service.softRemove(FOREIGN_ORGANIZATION)).rejects.toThrow(NotFoundException);

				expect((await stored(FOREIGN_ORGANIZATION))?.deletedAt ?? null).toBeNull();
			});

			it('scopes the inherited route shape too, whose options are an empty array', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				// `CrudController` hands the service its rest parameter, which Nest fills with an empty array.
				await expect(service.softRemove(FOREIGN_TENANT, [] as never)).rejects.toThrow(NotFoundException);
				await expect(service.softRemove(OWN, [] as never)).resolves.toMatchObject({ id: OWN });

				expect((await stored(FOREIGN_TENANT))?.deletedAt ?? null).toBeNull();
			});

			it('lets a caller’s criterion narrow the scope, never widen it', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				// A `where` naming the other tenant is overwritten by the caller's own scope, not honoured.
				await expect(
					service.softRemove(FOREIGN_TENANT, {
						where: { tenantId: TENANT_B, organizationId: ORGANIZATION_B }
					} as never)
				).rejects.toThrow(NotFoundException);

				expect((await stored(FOREIGN_TENANT))?.deletedAt ?? null).toBeNull();
			});

			it('restores the caller’s own retired row — the lookup still sees retired rows', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				await retire(ormType, OWN);

				await expect(service.softRecover(OWN)).resolves.toMatchObject({ id: OWN });

				expect((await stored(OWN))?.deletedAt ?? null).toBeNull();
			});

			it('refuses to restore a retired row of another tenant, and leaves it retired', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				await retire(ormType, FOREIGN_TENANT);

				await expect(service.softRecover(FOREIGN_TENANT)).rejects.toThrow(NotFoundException);
				await expect(service.softRecover(FOREIGN_TENANT, [] as never)).rejects.toThrow(NotFoundException);

				expect((await stored(FOREIGN_TENANT))?.deletedAt).toBeTruthy();
			});

			it('fails closed with no signed-in caller', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				mockCaller.tenantId = null;
				mockCaller.organizationId = null;

				// `null` is `IS NULL` on both ORMs, and every payment row carries both columns.
				await expect(service.softRemove(OWN)).rejects.toThrow(NotFoundException);

				expect((await stored(OWN))?.deletedAt ?? null).toBeNull();
			});
		});

		/**
		 * The hard delete `DELETE /:id` reaches: the kernel's `CrudService.delete`, by identifier alone.
		 *
		 * The capture ledger is left out because it refuses every delete on its own
		 * (`PAYMENT_CAPTURE_APPEND_ONLY`), which its service spec pins.
		 */
		describe.each(SERVICES.filter(({ name }) => name !== 'PaymentCaptureService'))(
			'$name — delete',
			({ build }) => {
				it('deletes the caller’s own row', async () => {
					const { typeOrm, mikroOrm, stored } = await arrange(ormType);
					const service = build(typeOrm, mikroOrm);

					await expect(service.delete(OWN)).resolves.toMatchObject({ affected: 1 });

					expect(await stored(OWN)).toBeNull();
				});

				it('never reaches a row of another tenant or of another organization, and leaves both in place', async () => {
					const { typeOrm, mikroOrm, stored } = await arrange(ormType);
					const service = build(typeOrm, mikroOrm);

					// The failure scenario: `DELETE /:id` with the identifier of another tenant's row.
					await expect(service.delete(FOREIGN_TENANT)).resolves.toMatchObject({ affected: 0 });
					await expect(service.delete(FOREIGN_ORGANIZATION)).resolves.toMatchObject({ affected: 0 });
					// A criterion naming the other tenant is overwritten by the caller's own scope.
					await expect(
						service.delete({
							id: FOREIGN_TENANT,
							tenantId: TENANT_B,
							organizationId: ORGANIZATION_B
						} as never)
					).resolves.toMatchObject({ affected: 0 });

					expect(await stored(FOREIGN_TENANT)).toMatchObject({ id: FOREIGN_TENANT });
					expect(await stored(FOREIGN_ORGANIZATION)).toMatchObject({ id: FOREIGN_ORGANIZATION });
				});

				it('refuses a criterion that selects nothing on its own, rather than deleting the whole organization', async () => {
					const { typeOrm, mikroOrm, stored } = await arrange(ormType);
					const service = build(typeOrm, mikroOrm);

					// Judged merged, the scope alone would have been the predicate: every row of the caller.
					await expect(service.delete({ id: undefined } as never)).rejects.toThrow(BadRequestException);

					expect(await stored(OWN)).toMatchObject({ id: OWN });
				});
			}
		);

		it('CONTROL: the kernel’s unscoped pair retires the other tenant’s row, which is the defect', async () => {
			const { typeOrm, mikroOrm, stored } = await arrange(ormType);
			const service = new PaymentSessionService(
				typeOrm as never,
				mikroOrm as never,
				{} as never,
				{} as never,
				{} as never
			);

			// The base-class method, called past the override: what every route and field reached before.
			await expect(CrudService.prototype.softRemove.call(service, FOREIGN_TENANT)).resolves.toMatchObject({
				id: FOREIGN_TENANT
			});

			expect((await stored(FOREIGN_TENANT))?.deletedAt).toBeTruthy();
		});

		it('CONTROL: the kernel’s unscoped delete erases the other tenant’s row, which is the defect', async () => {
			const { typeOrm, mikroOrm, stored } = await arrange(ormType);
			const service = new RefundReasonService(typeOrm as never, mikroOrm as never);

			// What `DELETE /refund-reasons/:id` (and the four routes like it) reached before.
			await expect(CrudService.prototype.delete.call(service, FOREIGN_TENANT)).resolves.toMatchObject({
				affected: 1
			});

			expect(await stored(FOREIGN_TENANT)).toBeNull();
		});
	});
});
