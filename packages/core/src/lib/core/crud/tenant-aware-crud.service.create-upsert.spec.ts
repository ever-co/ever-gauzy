// Must stay first: loads the entity graph before the service pulls an entity.
import '../entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../context';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

/**
 * `create()` with the id of an existing row is an upsert: TypeORM's `save()` updates the row it names. The tenant guard
 * kept it in the caller's tenant, but nothing kept it to a row the caller could update. An employee without
 * CHANGE_SELECTED_EMPLOYEE who posted a colleague's row id to any CRUD `POST` route (the CRUD base's `create`)
 * rewrote that row — and `create()` then stamped the caller's own employee on it, moving it onto their records.
 * `update()` refuses the same write: it reads the row through the employee scope first.
 */

const TENANT = 'c1000000-0000-4000-8000-00000000000a';
const EMPLOYEE_A = 'c1000000-0000-4000-8000-0000000000e1';
const EMPLOYEE_B = 'c1000000-0000-4000-8000-0000000000e2';
const COLLEAGUE_ROW = 'c1000000-0000-4000-8000-000000000b01';
const OWN_ROW = 'c1000000-0000-4000-8000-000000000a01';
const UNOWNED_ROW = 'c1000000-0000-4000-8000-000000000c01';

const TenantSchema = new EntitySchema<any>({
	name: 'Tenant',
	tableName: 'tenant',
	columns: { id: { primary: true, type: 'varchar' } }
});

const EmployeeSchema = new EntitySchema<any>({
	name: 'Employee',
	tableName: 'employee',
	columns: { id: { primary: true, type: 'varchar' }, tenantId: { type: 'varchar', nullable: true } }
});

/** A personal row: the scope columns the CRUD service reads, and one value. */
const NoteSchema = new EntitySchema<any>({
	name: 'Note',
	tableName: 'note',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		text: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' } },
		employee: { type: 'many-to-one', target: 'Employee', joinColumn: { name: 'employeeId' } }
	}
});

class NoteService extends TenantAwareCrudService<any> {}

/** A service whose rows are strictly personal: a caller with no employee record reaches none. */
class PersonalNoteService extends TenantAwareCrudService<any> {
	protected override findConditionsWithoutOwnEmployee() {
		return this.neverMatchingEmployeeCondition();
	}
}

describe('TenantAwareCrudService.create — an id that names an existing row', () => {
	let dataSource: DataSource;
	let notes: Repository<any>;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TenantSchema, EmployeeSchema, NoteSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.getRepository('Tenant').save([{ id: TENANT }]);
		await dataSource.getRepository('Employee').save([
			{ id: EMPLOYEE_A, tenantId: TENANT },
			{ id: EMPLOYEE_B, tenantId: TENANT }
		]);
		notes = dataSource.getRepository('Note');
		await notes.save([
			{ id: COLLEAGUE_ROW, text: 'colleague', tenantId: TENANT, employeeId: EMPLOYEE_B },
			{ id: OWN_ROW, text: 'mine', tenantId: TENANT, employeeId: EMPLOYEE_A },
			{ id: UNOWNED_ROW, text: 'nobody', tenantId: TENANT, employeeId: null }
		]);

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	const signIn = (employeeId: string | null, permissions: PermissionsEnum[] = []) => {
		const user = { id: 'user-1', tenantId: TENANT, employeeId, permissions };
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({ _req: { user } } as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			permissions.includes(permission)
		);
	};

	const row = async (id: string) => {
		const found = await notes.findOne({ where: { id }, withDeleted: true });
		return found && { text: found.text, employeeId: found.employeeId };
	};

	describe('an employee without CHANGE_SELECTED_EMPLOYEE', () => {
		beforeEach(() => signIn(EMPLOYEE_A));

		it("cannot rewrite a colleague's row, nor move it onto their own records", async () => {
			const service = new NoteService(notes as any, {} as any);

			await expect(service.create({ id: COLLEAGUE_ROW, text: 'rewritten' } as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(await row(COLLEAGUE_ROW)).toEqual({ text: 'colleague', employeeId: EMPLOYEE_B });

			await expect(
				service.createMany([{ text: 'new' }, { id: COLLEAGUE_ROW, text: 'rewritten' }] as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(await row(COLLEAGUE_ROW)).toEqual({ text: 'colleague', employeeId: EMPLOYEE_B });
		});

		it('cannot claim a row that belongs to no employee', async () => {
			const service = new NoteService(notes as any, {} as any);

			await expect(service.create({ id: UNOWNED_ROW, text: 'claimed' } as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(await row(UNOWNED_ROW)).toEqual({ text: 'nobody', employeeId: null });
		});

		it('still upserts their own row, and creates new rows with or without an id (controls)', async () => {
			const service = new NoteService(notes as any, {} as any);
			const NEW_ID = 'c1000000-0000-4000-8000-000000000a02';

			await service.create({ id: OWN_ROW, text: 'edited' } as any);
			await service.create({ text: 'fresh' } as any);
			await service.create({ id: NEW_ID, text: 'with an id' } as any);

			expect(await row(OWN_ROW)).toEqual({ text: 'edited', employeeId: EMPLOYEE_A });
			expect(await row(NEW_ID)).toEqual({ text: 'with an id', employeeId: EMPLOYEE_A });
			expect(await notes.count({ where: { text: 'fresh', employeeId: EMPLOYEE_A } })).toBe(1);
		});
	});

	it('lets a caller with CHANGE_SELECTED_EMPLOYEE write any row of the tenant (control)', async () => {
		signIn(null, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
		const service = new NoteService(notes as any, {} as any);

		await service.create({ id: COLLEAGUE_ROW, text: 'by an admin' } as any);

		expect(await row(COLLEAGUE_ROW)).toEqual({ text: 'by an admin', employeeId: EMPLOYEE_B });
	});

	it('holds a caller with no employee record to the scope its service sets', async () => {
		signIn(null);

		await expect(
			new PersonalNoteService(notes as any, {} as any).create({ id: COLLEAGUE_ROW, text: 'x' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(await row(COLLEAGUE_ROW)).toEqual({ text: 'colleague', employeeId: EMPLOYEE_B });

		// The default (tenant-wide) scope still reaches the row, as update() does.
		await new NoteService(notes as any, {} as any).create({ id: COLLEAGUE_ROW, text: 'tenant-wide' } as any);
		expect(await row(COLLEAGUE_ROW)).toEqual({ text: 'tenant-wide', employeeId: EMPLOYEE_B });
	});
});
