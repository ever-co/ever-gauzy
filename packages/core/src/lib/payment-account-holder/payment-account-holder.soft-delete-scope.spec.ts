import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { PaymentMethodTokenService } from '../payment-method-token/payment-method-token.service';
import { PaymentAccountHolderService } from './payment-account-holder.service';

/**
 * The inherited soft-delete pair of the two kernel payment services, run for real against a row of a sibling
 * organization.
 *
 * `PaymentAccountHolderService` and `PaymentMethodTokenService` extend `TenantAwareCrudService`, so the
 * `softRemove` and `softRecover` they inherit — `DELETE /payment-method-tokens/:id/soft`,
 * `PUT /payment-account-holders/:id/recover`, `PUT /payment-method-tokens/:id/recover` and the GraphQL
 * `softDeletePaymentMethodToken`, `recoverPaymentAccountHolder` and `recoverPaymentMethodToken` fields that
 * mirror them — resolved their row through the tenant-aware read, which adds the caller's **tenant** and
 * nothing else. Every other read either service makes is scoped to the caller's tenant **and organization**,
 * so a caller who knew the identifier of an instrument or an account of another organization of the same
 * tenant could retire it, restore it and be handed it back, while every read of that organization's own
 * rows answered "not found". The eight payment-plugin services were closed against the same gap by
 * `PaymentScopedCrudService` (017b56d63c); these two sit in the kernel and were left out.
 *
 * The suite covers both services because they share the defect and the harness. The account-holder removal
 * the plugin serves goes through the kernel's `softRemoveHolder`, which was already scoped; the inherited
 * `softRemove` is pinned here all the same, because it is a public member of the service and nothing stops a
 * caller reaching for it.
 *
 * **Nothing the defect lives in is doubled.** The services are the real ones over the kernel's real
 * `TenantAwareCrudService` and `CrudService`; the repositories are real — TypeORM over an in-memory
 * better-sqlite3 database, and the kernel's own `MikroOrmBaseEntityRepository` over another, with the
 * production soft-delete extension (`mikro-orm-soft-delete`'s `SoftDeletable` and `SoftDeleteHandler`), so a
 * retired row is filtered out by default and a removal is an `UPDATE … SET deletedAt`, as in production.
 * Each ORM branch of the kernel's pair is selected the way the application selects it, through
 * `CrudService.ormType`.
 *
 * **Each ORM is given what it has in production.** Under TypeORM the tenant-aware base reads the entity's
 * column metadata and adds the caller's tenant, as a relation and as a column, so the TypeORM fixture carries
 * both. Under `DB_ORM=mikro-orm` TypeORM carries no column metadata for an entity — `MultiORMColumn` registers
 * only the active ORM's decorator — so the tenant-aware base finds no `tenantId` column and adds nothing; the
 * MikroORM branch is therefore handed a TypeORM repository whose metadata knows no column, which is the only
 * thing that branch reads from it. On that branch the tenant is exactly as unscoped as the organization, and
 * the cases below prove both.
 *
 * The rows are standalone fixtures rather than the payment entities, for the reason the kernel's ORM
 * conformance suite gives: the production base entity carries a Postgres-only identifier default SQLite
 * rejects. The pair reads nothing of a row but its identifier, its tenant, its organization and its deletion
 * date, so a fixture with exactly those is the whole of what it acts on here.
 */

/** The caller's tenant and organization. */
const TENANT_A = '64000000-0000-4000-8000-00000000000a';
const ORGANIZATION_A = '64000000-0000-4000-8000-0000000000a1';

/** Another organization of the caller's own tenant, and another tenant. */
const ORGANIZATION_A2 = '64000000-0000-4000-8000-0000000000a2';
const TENANT_B = '64000000-0000-4000-8000-00000000000b';
const ORGANIZATION_B = '64000000-0000-4000-8000-0000000000b1';

/** The rows: the caller's own, one of a sibling organization, and one of another tenant. */
const OWN = '64000000-0000-4000-8000-000000000001';
const SIBLING_ORGANIZATION = '64000000-0000-4000-8000-000000000002';
const FOREIGN_TENANT = '64000000-0000-4000-8000-000000000003';

/** The rows every case starts from. */
const SEED = [
	{ id: OWN, tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: SIBLING_ORGANIZATION, tenantId: TENANT_A, organizationId: ORGANIZATION_A2, deletedAt: null },
	{ id: FOREIGN_TENANT, tenantId: TENANT_B, organizationId: ORGANIZATION_B, deletedAt: null }
];

/** The tenant table the TypeORM fixture's `tenant` relation points at. */
const TenantFixtureSchema = new EntitySchema<{ id: string }>({
	name: 'PaymentScopeTenant',
	tableName: 'payment_scope_tenant',
	columns: { id: { primary: true, type: 'varchar' } }
});

/**
 * The row for TypeORM. The `tenant` relation is there because the tenant-aware base states the tenant as a
 * relation as well as a column, as it does for every `TenantBaseEntity`; `deleteDate` is what makes a TypeORM
 * read hide a retired row.
 */
const PaymentScopeRowSchema = new EntitySchema<any>({
	name: 'PaymentScopeRow',
	tableName: 'payment_scope_row',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'PaymentScopeTenant', nullable: true, joinColumn: { name: 'tenantId' } }
	}
});

/** The same table for MikroORM, soft-deletable the way `SoftDeletableBaseEntity` is. */
@SoftDeletable(() => PaymentScopeRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'payment_scope_row' })
class PaymentScopeRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

/** The soft-delete pair both services inherit, which is all this suite drives. */
interface ISoftDeletePair {
	softRemove(id: string, options?: unknown): Promise<any>;
	softRecover(id: string, options?: unknown): Promise<any>;
}

/**
 * The two services, each built over the two repositories. The collaborator each names beyond them — the
 * instrument service, the account table — is never reached by the pair, so it is an empty object: a pair
 * that did reach one would fail here loudly rather than pass on a double's answer.
 */
const SERVICES: ReadonlyArray<{ name: string; build: (typeOrm: unknown, mikroOrm: unknown) => ISoftDeletePair }> = [
	{
		name: 'PaymentAccountHolderService',
		build: (typeOrm, mikroOrm) => new PaymentAccountHolderService(typeOrm as never, mikroOrm as never, {} as never)
	},
	{
		name: 'PaymentMethodTokenService',
		build: (typeOrm, mikroOrm) => new PaymentMethodTokenService(typeOrm as never, mikroOrm as never, {} as never)
	}
];

/**
 * What the tenant-aware base can learn from TypeORM about an entity under `DB_ORM=mikro-orm`: that it has no
 * column. It is the only member of the TypeORM repository the MikroORM branch of the pair reads.
 */
const TYPEORM_WITHOUT_COLUMNS = { metadata: { hasColumnWithPropertyPath: () => false } };

/** The caller the request context answers with; each case states it. */
const caller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

describe('PaymentAccountHolderService and PaymentMethodTokenService — the soft-delete pair stays inside the caller’s organization', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<any>;
	let orm: MikroORM<BetterSqliteDriver>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TenantFixtureSchema, PaymentScopeRowSchema],
			synchronize: true,
			logging: false,
			// The platform's shipped setting: `null` is `IS NULL`, which is what makes a call with no caller
			// match no row rather than every row.
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.getRepository('PaymentScopeTenant').save([{ id: TENANT_A }, { id: TENANT_B }]);
		typeOrmRows = dataSource.getRepository('PaymentScopeRow');

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [PaymentScopeRow],
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
	async function arrange(ormType: MultiORMEnum): Promise<{
		typeOrm: unknown;
		mikroOrm: unknown;
		stored: (id: string) => Promise<{ deletedAt?: Date | null } | null>;
	}> {
		await typeOrmRows.clear();
		await typeOrmRows.save(SEED.map((row) => ({ ...row })));

		await orm.em.getConnection().execute('DELETE FROM payment_scope_row');
		const em = orm.em.fork();
		for (const row of SEED) {
			em.persist(em.create(PaymentScopeRow, { ...row }));
		}
		await em.flush();

		caller.tenantId = TENANT_A;
		caller.organizationId = ORGANIZATION_A;

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => caller.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockImplementation(() => caller.organizationId);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(() =>
			caller.tenantId ? ({ id: 'user-1', tenantId: caller.tenantId } as any) : null
		);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);

		return ormType === MultiORMEnum.TypeORM
			? {
					typeOrm: typeOrmRows,
					mikroOrm: {},
					// Read with retired rows included and outside any scope, so the assertion sees what is stored.
					stored: (id: string) => typeOrmRows.findOne({ where: { id }, withDeleted: true })
				}
			: {
					typeOrm: TYPEORM_WITHOUT_COLUMNS,
					mikroOrm: new MikroOrmBaseEntityRepository<PaymentScopeRow>(orm.em.fork(), PaymentScopeRow),
					stored: (id: string) => orm.em.fork().findOne(PaymentScopeRow, { id }, { filters: false })
				};
	}

	/** Retires one row directly in the database the branch reads, outside any service. */
	async function retire(ormType: MultiORMEnum, id: string): Promise<void> {
		if (ormType === MultiORMEnum.TypeORM) {
			await typeOrmRows.softDelete(id);
			return;
		}

		// The production extension turns this removal into `UPDATE … SET deletedAt`, as it does in the app.
		const em = orm.em.fork();
		em.remove(await em.findOneOrFail(PaymentScopeRow, { id }));
		await em.flush();
	}

	describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('on the %s branch', (ormType) => {
		describe.each(SERVICES)('$name', ({ build }) => {
			it('retires the caller’s own row, and answers with it', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				await expect(service.softRemove(OWN)).resolves.toMatchObject({ id: OWN });

				expect((await stored(OWN))?.deletedAt).toBeTruthy();
			});

			it('refuses to retire a row of another organization of the caller’s tenant, and leaves it live', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				// The failure scenario: a caller in organization A1 who knows the identifier of A2's row.
				await expect(service.softRemove(SIBLING_ORGANIZATION)).rejects.toThrow(NotFoundException);

				expect((await stored(SIBLING_ORGANIZATION))?.deletedAt ?? null).toBeNull();
			});

			it('refuses to retire a row of another tenant, and leaves it live', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				await expect(service.softRemove(FOREIGN_TENANT)).rejects.toThrow(NotFoundException);

				expect((await stored(FOREIGN_TENANT))?.deletedAt ?? null).toBeNull();
			});

			it('scopes the inherited route shape too, whose options are an empty array', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				// `CrudController` hands the service its rest parameter, which Nest fills with an empty array.
				await expect(service.softRemove(SIBLING_ORGANIZATION, [])).rejects.toThrow(NotFoundException);
				await expect(service.softRemove(OWN, [])).resolves.toMatchObject({ id: OWN });

				expect((await stored(SIBLING_ORGANIZATION))?.deletedAt ?? null).toBeNull();
			});

			it('lets a caller’s criterion narrow the scope, never widen it', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);

				// A `where` naming the sibling organization is overwritten by the caller's own scope, not honoured.
				await expect(
					service.softRemove(SIBLING_ORGANIZATION, { where: { organizationId: ORGANIZATION_A2 } })
				).rejects.toThrow(NotFoundException);

				expect((await stored(SIBLING_ORGANIZATION))?.deletedAt ?? null).toBeNull();
			});

			it('restores the caller’s own retired row — the lookup still sees retired rows', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				await retire(ormType, OWN);

				await expect(service.softRecover(OWN, [])).resolves.toMatchObject({ id: OWN });

				expect((await stored(OWN))?.deletedAt ?? null).toBeNull();
			});

			it('refuses to restore a retired row of another organization of the caller’s tenant, and leaves it retired', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				await retire(ormType, SIBLING_ORGANIZATION);

				await expect(service.softRecover(SIBLING_ORGANIZATION)).rejects.toThrow(NotFoundException);
				await expect(service.softRecover(SIBLING_ORGANIZATION, [])).rejects.toThrow(NotFoundException);

				expect((await stored(SIBLING_ORGANIZATION))?.deletedAt).toBeTruthy();
			});

			it('refuses to restore a retired row of another tenant, and leaves it retired', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				await retire(ormType, FOREIGN_TENANT);

				await expect(service.softRecover(FOREIGN_TENANT)).rejects.toThrow(NotFoundException);

				expect((await stored(FOREIGN_TENANT))?.deletedAt).toBeTruthy();
			});

			it('fails closed with no signed-in caller', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const service = build(typeOrm, mikroOrm);
				caller.tenantId = null;
				caller.organizationId = null;

				// `null` is `IS NULL` on both ORMs, and every payment row carries both columns.
				await expect(service.softRemove(OWN)).rejects.toThrow(NotFoundException);

				expect((await stored(OWN))?.deletedAt ?? null).toBeNull();
			});
		});

		it('CONTROL: the tenant-aware pair, called past the override, retires the sibling organization’s row', async () => {
			const { typeOrm, mikroOrm, stored } = await arrange(ormType);
			const service = SERVICES[1].build(typeOrm, mikroOrm);

			// What every route and field reached before: the fixture can see the row, and only the scope refuses it.
			await expect(CrudService.prototype.softRemove.call(service, SIBLING_ORGANIZATION)).resolves.toMatchObject({
				id: SIBLING_ORGANIZATION
			});

			expect((await stored(SIBLING_ORGANIZATION))?.deletedAt).toBeTruthy();
		});
	});
});
