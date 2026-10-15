import '../entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../context';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

/**
 * A row of the caller's tenant may not POINT at a row of another tenant (SEC-D-03).
 *
 * The cross-tenant check (`assertGraphNotForeign`, GHSA-jh6m-9fxr-rx3c) refused a nested relation object —
 * `{ cart: { id: <foreign> } }` — but passed the same reference as its foreign-key column — `{ cartId: <foreign> }` —
 * which every commerce DTO exposes; and `update()` never ran the check at all. 55 generic create/update routes
 * accepted another tenant's ids: cart lines and shipping charges added to another tenant's cart (and copied into its
 * order at checkout), another tenant's products, price books, stock and suppliers read back through `relations`,
 * foreign-key restrictions that stopped the victim deleting their own rows.
 *
 * A real SQLite database, the real service, two tenants.
 */

const TENANT_A = 'a3000000-0000-4000-8000-00000000000a';
const TENANT_B = 'a3000000-0000-4000-8000-00000000000b';

const TenantSchema = new EntitySchema<any>({
	name: 'Tenant',
	tableName: 'tenant',
	columns: { id: { primary: true, type: 'varchar' } }
});

const ParentSchema = new EntitySchema<any>({
	name: 'FkParent',
	tableName: 'fk_parent',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		name: { type: 'varchar', nullable: true }
	},
	relations: { tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' } } }
});

const ChildSchema = new EntitySchema<any>({
	name: 'FkChild',
	tableName: 'fk_child',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		name: { type: 'varchar', nullable: true },
		parentId: { type: 'varchar', nullable: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' } },
		parent: { type: 'many-to-one', target: 'FkParent', joinColumn: { name: 'parentId' } }
	}
});

class ChildService extends TenantAwareCrudService<any> {}

describe('TenantAwareCrudService — a row may not point at another tenant’s row (SEC-D-03)', () => {
	let dataSource: DataSource;
	let parents: Repository<any>;
	let children: Repository<any>;
	let service: ChildService;
	let ownParent: any;
	let ownParent2: any;
	let foreignParent: any;
	let ownChild: any;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TenantSchema, ParentSchema, ChildSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.getRepository('Tenant').save([{ id: TENANT_A }, { id: TENANT_B }]);
		parents = dataSource.getRepository('FkParent');
		children = dataSource.getRepository('FkChild');
		ownParent = await parents.save({ tenantId: TENANT_A, name: 'own' });
		ownParent2 = await parents.save({ tenantId: TENANT_A, name: 'own-2' });
		foreignParent = await parents.save({ tenantId: TENANT_B, name: 'foreign' });
		ownChild = await children.save({ tenantId: TENANT_A, name: 'child', parentId: ownParent.id });

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-a', tenantId: TENANT_A } as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		service = new ChildService(children as any, {} as any);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	it('refuses to create a row whose foreign-key column names another tenant’s row', async () => {
		await expect(service.create({ name: 'smuggled', parentId: foreignParent.id } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);

		expect(await children.countBy({ name: 'smuggled' })).toBe(0);
	});

	it('refuses to point an existing row at another tenant’s row through an update', async () => {
		await expect(service.update(ownChild.id, { parentId: foreignParent.id } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);

		expect((await children.findOneBy({ id: ownChild.id })).parentId).toBe(ownParent.id);
	});

	it('refuses the relation object form on an update too', async () => {
		await expect(
			service.update(ownChild.id, { parent: { id: foreignParent.id } } as any)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect((await children.findOneBy({ id: ownChild.id })).parentId).toBe(ownParent.id);
	});

	it('still creates and re-points rows inside the caller’s tenant', async () => {
		const created = await service.create({ name: 'fine', parentId: ownParent.id } as any);
		expect((await children.findOneBy({ id: created.id })).parentId).toBe(ownParent.id);

		await service.update(ownChild.id, { parentId: ownParent2.id } as any);
		expect((await children.findOneBy({ id: ownChild.id })).parentId).toBe(ownParent2.id);
	});
});
