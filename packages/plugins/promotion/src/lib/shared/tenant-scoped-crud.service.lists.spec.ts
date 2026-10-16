import { DataSource, EntitySchema, Repository } from 'typeorm';
import { CrudService, RequestContext } from '@gauzy/core';
import { TenantScopedCrudService } from './tenant-scoped-crud.service';

/**
 * The inherited list routes of the promotion plugin (SEC-D-01).
 *
 * None of the nine promotion controllers declares its own `GET ''`, `GET /pagination` or `GET /count`, so the
 * inherited handlers call `findAll` / `paginate` / `countBy` — and this base scoped only reads by id, the update,
 * the delete and the soft-delete pair. The 27 list routes returned EVERY tenant's rows: gift-card codes and
 * balances, coupon codes and limits, promotion usages with other tenants' customer / cart / order ids, and
 * `/pagination?where[code]=…` + `/count` as cross-tenant oracles. The GraphQL lists were scoped; only REST leaked.
 *
 * The real base over a real SQLite table, with the caller's row, another tenant's and a sibling organization's.
 */

const TENANT = 'b1000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = 'b1000000-0000-4000-8000-00000000000b';
const ORG = 'b1000000-0000-4000-8000-0000000000a1';
const SIBLING_ORG = 'b1000000-0000-4000-8000-0000000000a2';
const OTHER_ORG = 'b1000000-0000-4000-8000-0000000000b1';

const PromoRowSchema = new EntitySchema<any>({
	name: 'PromoListRow',
	tableName: 'promo_list_row',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		code: { type: 'varchar' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

class PromoRowService extends TenantScopedCrudService<any> {}

describe('TenantScopedCrudService — the inherited list routes read the caller’s rows only (SEC-D-01)', () => {
	let dataSource: DataSource;
	let rows: Repository<any>;
	let service: PromoRowService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [PromoRowSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		rows = dataSource.getRepository('PromoListRow');
		await rows.save([
			{ id: 'own', tenantId: TENANT, organizationId: ORG, code: 'OWN-GIFT' },
			{ id: 'sibling', tenantId: TENANT, organizationId: SIBLING_ORG, code: 'SIBLING-GIFT' },
			{ id: 'foreign', tenantId: OTHER_TENANT, organizationId: OTHER_ORG, code: 'FOREIGN-GIFT' }
		]);
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue('typeorm' as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		service = new PromoRowService(rows as any, {} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const ids = (items: Array<{ id: string }>) => items.map((item) => item.id).sort();

	it('GET / (findAll) answers the caller’s rows only', async () => {
		// The failure scenario: `GET /api/gift-cards` answered every gift card on the installation.
		const { items, total } = await service.findAll();

		expect(ids(items)).toEqual(['own']);
		expect(total).toBe(1);
	});

	it('GET /pagination (paginate) answers the caller’s rows only, whatever the filter names', async () => {
		const page = await service.paginate({ where: { code: 'FOREIGN-GIFT' } } as any);
		expect(ids(page.items)).toEqual([]);

		const all = await service.paginate({ take: 10, skip: 0 } as any);
		expect(ids(all.items)).toEqual(['own']);
	});

	it('GET /count (countBy) and count are no cross-tenant oracle', async () => {
		await expect(service.countBy({ code: 'FOREIGN-GIFT' } as any)).resolves.toBe(0);
		await expect(service.countBy()).resolves.toBe(1);
		await expect(service.count()).resolves.toBe(1);
	});

	it('find answers the caller’s rows only, and a where naming another tenant is narrowed back', async () => {
		expect(ids(await service.find())).toEqual(['own']);
		// The scope is spread last: the stated tenant is replaced by the caller's, never widened to another one.
		expect(ids(await service.find({ where: { tenantId: OTHER_TENANT } } as any))).toEqual(['own']);
	});
});
