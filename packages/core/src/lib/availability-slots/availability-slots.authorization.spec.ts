// Must stay first: loads the entity graph before the handlers pull an entity.
import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilitySlotsResolver } from './availability-slots.resolver';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsBulkCreateCommand, AvailabilitySlotsCreateCommand } from './commands';
import { AvailabilitySlotsBulkCreateHandler } from './commands/handlers/availability-slots.bulk.create.handler';
import { AvailabilitySlotsCreateHandler } from './commands/handlers/availability-slots.create.handler';
import { GetConflictAvailabilitySlotsHandler } from './commands/handlers/get-conflict-availability-slots.handler';
import { GetConflictAvailabilitySlotsCommand } from './commands/get-conflict-availability-slots.command';

/**
 * Who may write whose availability, and what a write that replaces conflicting slots leaves behind when it fails.
 *
 * Availability slots are an employee's bookable hours (Employees → Appointments → Schedules; public booking reads
 * them). The routes and the GraphQL fields carry `TenantPermissionGuard` only — on purpose: the Appointments menu
 * states no permission, so every employee manages their own hours there. What keeps one employee's hours their own
 * is the employee scope `TenantAwareCrudService` applies to a caller WITHOUT `CHANGE_SELECTED_EMPLOYEE`. These cases
 * run the real controller, resolver, command handlers and service against a real SQLite database, so they state what
 * a caller can actually do to rows, not which arguments a mock received:
 *
 * - an employee filing a slot "for" a colleague must neither touch the colleague's slots nor learn their times
 *   (the merge used to widen the caller's new slot over the colleague's conflicting ones);
 * - `PUT /:id` (and `updateAvailabilitySlot`) was an upsert on ANY id of the tenant: it rewrote a colleague's slot and
 *   moved it onto the caller's own calendar;
 * - an id in a create body was honoured the same way;
 * - a signed-in user with no employee record (a candidate, a viewer) was not scoped at all — it could read, delete and
 *   replace every employee's slots;
 * - a merge deleted the conflicting slots and then saved the new one in a separate statement, so a failed save lost
 *   the employee's existing hours.
 */

const TENANT = 'a5000000-0000-4000-8000-00000000000a';
const ORGANIZATION = 'a5000000-0000-4000-8000-0000000000a1';
const EMPLOYEE_A = 'a5000000-0000-4000-8000-0000000000e1';
const EMPLOYEE_B = 'a5000000-0000-4000-8000-0000000000e2';

const COLLEAGUE_SLOT = 'a5000000-0000-4000-8000-000000000b01';
const COLLEAGUE_SLOT_ON_FAILING_DAY = 'a5000000-0000-4000-8000-000000000b02';

/** An instant on the test week, UTC. */
const at = (day: string, time: string) => new Date(`2026-11-${day}T${time}:00.000Z`);

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

/** The columns the slot routes read and write, with the two scope relations the CRUD service names. */
const AvailabilitySlotSchema = new EntitySchema<any>({
	name: 'AvailabilitySlot',
	tableName: 'availability_slot',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		startTime: { type: 'datetime' },
		endTime: { type: 'datetime' },
		allDay: { type: 'boolean', default: false },
		type: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' } },
		employee: { type: 'many-to-one', target: 'Employee', joinColumn: { name: 'employeeId' } }
	}
});

interface ICaller {
	id: string;
	employeeId: string | null;
	permissions: PermissionsEnum[];
}

const EMPLOYEE_A_USER: ICaller = { id: 'user-a', employeeId: EMPLOYEE_A, permissions: [] };
const NO_EMPLOYEE_RECORD_USER: ICaller = { id: 'user-candidate', employeeId: null, permissions: [] };
const MANAGER: ICaller = {
	id: 'user-manager',
	employeeId: null,
	permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
};

describe('Availability slots — whose hours a caller may write, on a real database', () => {
	let dataSource: DataSource;
	let slots: Repository<any>;
	let service: AvailabilitySlotsService;
	let controller: AvailabilitySlotsController;
	let resolver: AvailabilitySlotsResolver;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TenantSchema, EmployeeSchema, AvailabilitySlotSchema],
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
		slots = dataSource.getRepository('AvailabilitySlot');
		await slots.save([
			{
				id: COLLEAGUE_SLOT,
				startTime: at('02', '10:00'),
				endTime: at('02', '12:00'),
				type: 'Default',
				allDay: false,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE_B
			},
			{
				id: COLLEAGUE_SLOT_ON_FAILING_DAY,
				startTime: at('03', '09:00'),
				endTime: at('03', '10:00'),
				type: 'Default',
				allDay: false,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE_B
			}
		]);
		// A write the database itself refuses: every new slot on 3 November. Created after the seed, so it fails
		// exactly the write under test — the save that follows the removal of the conflicting slots.
		await dataSource.query(
			`CREATE TRIGGER "refuse_new_slots_on_the_3rd" BEFORE INSERT ON "availability_slot"
			 WHEN NEW."startTime" LIKE '2026-11-03%'
			 BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`
		);

		service = new AvailabilitySlotsService(slots as any, {} as any);
		const conflictHandler = new GetConflictAvailabilitySlotsHandler(slots as any, {} as any, {
			dbConnectionOptions: { type: 'better-sqlite3' }
		} as any);
		const commandBus: any = {
			execute: (command: unknown) => {
				if (command instanceof GetConflictAvailabilitySlotsCommand) return conflictHandler.execute(command);
				if (command instanceof AvailabilitySlotsCreateCommand) return createHandler.execute(command);
				if (command instanceof AvailabilitySlotsBulkCreateCommand) return bulkHandler.execute(command);
				throw new Error(`unexpected command ${(command as object)?.constructor?.name}`);
			}
		};
		const createHandler = new AvailabilitySlotsCreateHandler(service, commandBus);
		const bulkHandler = new AvailabilitySlotsBulkCreateHandler(commandBus);
		controller = new AvailabilitySlotsController(service, commandBus);
		resolver = new AvailabilitySlotsResolver(service, commandBus);

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	/** Runs the rest of the case as this signed-in user. */
	const signIn = (caller: ICaller) => {
		const user = { id: caller.id, tenantId: TENANT, employeeId: caller.employeeId, permissions: caller.permissions };
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({ _req: { user } } as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
	};

	/** Every stored slot, read past the CRUD service, as `employee start-end` on the test week. */
	const stored = async (): Promise<Record<string, string>> => {
		const rows = await slots.find({ withDeleted: true, order: { startTime: 'ASC' } });
		const hhmm = (value: Date | string) => new Date(value).toISOString().slice(8, 16).replace('T', ' ');
		return Object.fromEntries(
			rows.map((row) => [row.id, `${row.employeeId ?? 'none'} ${hhmm(row.startTime)}-${hhmm(row.endTime).slice(3)}${row.deletedAt ? ' (deleted)' : ''}`])
		);
	};

	const colleagueSlots = {
		[COLLEAGUE_SLOT]: `${EMPLOYEE_B} 02 10:00-12:00`,
		[COLLEAGUE_SLOT_ON_FAILING_DAY]: `${EMPLOYEE_B} 03 09:00-10:00`
	};

	describe('an employee (no CHANGE_SELECTED_EMPLOYEE)', () => {
		beforeEach(() => signIn(EMPLOYEE_A_USER));

		it('files a slot for a colleague as their own, without touching or reading the colleague’s hours', async () => {
			const created: any = await controller.create({
				startTime: at('02', '11:00'),
				endTime: at('02', '13:00'),
				employeeId: EMPLOYEE_B,
				organizationId: ORGANIZATION,
				type: 'Default',
				allDay: false
			} as any);

			// The failure scenario: the merge searched EMPLOYEE_B's slots, so the caller's new slot came back widened
			// to 10:00 — the start of a colleague's hours the caller has no right to read.
			expect(created.employeeId).toBe(EMPLOYEE_A);
			expect(await stored()).toEqual({ ...colleagueSlots, [created.id]: `${EMPLOYEE_A} 02 11:00-13:00` });
		});

		it('cannot rewrite a colleague’s slot through PUT /:id', async () => {
			await expect(
				controller.update(COLLEAGUE_SLOT, {
					startTime: at('02', '14:00'),
					endTime: at('02', '15:00'),
					type: 'Default',
					allDay: false
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			// The failure scenario: the upsert rewrote the row and moved it onto the caller (EMPLOYEE_A 14:00-15:00).
			expect(await stored()).toEqual(colleagueSlots);
		});

		it('cannot rewrite a colleague’s slot through updateAvailabilitySlot', async () => {
			await expect(
				resolver.updateAvailabilitySlot({
					id: COLLEAGUE_SLOT,
					startTime: at('02', '14:00'),
					endTime: at('02', '15:00'),
					type: 'Default',
					allDay: false
				})
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await stored()).toEqual(colleagueSlots);
		});

		it('cannot claim a colleague’s slot by naming its id in a create body', async () => {
			const created: any = await controller.create({
				id: COLLEAGUE_SLOT,
				startTime: at('04', '08:00'),
				endTime: at('04', '09:00'),
				organizationId: ORGANIZATION,
				type: 'Default',
				allDay: false
			} as any);

			expect(created.id).not.toBe(COLLEAGUE_SLOT);
			expect(await stored()).toEqual({ ...colleagueSlots, [created.id]: `${EMPLOYEE_A} 04 08:00-09:00` });
		});

		it('cannot delete or withdraw a colleague’s slot (DELETE /:id, deleteAvailabilitySlot, softDeleteAvailabilitySlot)', async () => {
			await controller.delete(COLLEAGUE_SLOT).catch(() => undefined);
			await resolver.deleteAvailabilitySlot(COLLEAGUE_SLOT).catch(() => undefined);
			await resolver.softDeleteAvailabilitySlot(COLLEAGUE_SLOT).catch(() => undefined);

			expect(await stored()).toEqual(colleagueSlots);
		});

		it('still edits their own slot through PUT /:id', async () => {
			const own: any = await controller.create({
				startTime: at('05', '08:00'),
				endTime: at('05', '09:00'),
				organizationId: ORGANIZATION,
				type: 'Default',
				allDay: false
			} as any);

			const updated: any = await controller.update(own.id, {
				startTime: at('05', '08:30'),
				endTime: at('05', '10:00'),
				type: 'Default',
				allDay: false
			} as any);

			expect(updated.id).toBe(own.id);
			expect(await stored()).toEqual({ ...colleagueSlots, [own.id]: `${EMPLOYEE_A} 05 08:30-10:00` });
		});
	});

	describe('a signed-in user with no employee record (candidate, viewer)', () => {
		beforeEach(() => signIn(NO_EMPLOYEE_RECORD_USER));

		it('cannot file a slot for an employee — nor replace that employee’s conflicting hours', async () => {
			await expect(
				controller.create({
					startTime: at('02', '11:00'),
					endTime: at('02', '13:00'),
					employeeId: EMPLOYEE_B,
					organizationId: ORGANIZATION,
					type: 'Default',
					allDay: false
				} as any)
			).rejects.toBeInstanceOf(ForbiddenException);

			// The failure scenario: the colleague's 10:00-12:00 slot was deleted and replaced by 10:00-13:00.
			expect(await stored()).toEqual(colleagueSlots);
		});

		it('cannot delete an employee’s slot', async () => {
			await service.delete(COLLEAGUE_SLOT).catch(() => undefined);

			expect(await stored()).toEqual(colleagueSlots);
		});

		it('cannot withdraw an employee’s slot through softDeleteAvailabilitySlot', async () => {
			await resolver.softDeleteAvailabilitySlot(COLLEAGUE_SLOT).catch(() => undefined);

			expect(await stored()).toEqual(colleagueSlots);
		});

		it('reads no employee’s slots', async () => {
			const { items } = await service.findAll({});

			expect(items).toEqual([]);
		});
	});

	describe('a manager (CHANGE_SELECTED_EMPLOYEE)', () => {
		beforeEach(() => signIn(MANAGER));

		it('files a slot for an employee and merges that employee’s conflicting hours into it', async () => {
			const created: any = await controller.create({
				startTime: at('02', '11:00'),
				endTime: at('02', '13:00'),
				employeeId: EMPLOYEE_B,
				organizationId: ORGANIZATION,
				type: 'Default',
				allDay: false
			} as any);

			expect(await stored()).toEqual({
				[COLLEAGUE_SLOT_ON_FAILING_DAY]: colleagueSlots[COLLEAGUE_SLOT_ON_FAILING_DAY],
				[created.id]: `${EMPLOYEE_B} 02 10:00-13:00`
			});
		});

		it('keeps the employee’s existing hours when the merged slot cannot be saved', async () => {
			await expect(
				controller.create({
					startTime: at('03', '09:30'),
					endTime: at('03', '11:00'),
					employeeId: EMPLOYEE_B,
					organizationId: ORGANIZATION,
					type: 'Default',
					allDay: false
				} as any)
			).rejects.toThrow();

			// The failure scenario: the conflicting 09:00-10:00 slot was already deleted when the save failed.
			expect(await stored()).toEqual(colleagueSlots);
		});

		it('keeps the employee’s existing hours when an entry of a bulk filing cannot be saved', async () => {
			await expect(
				controller.createBulkAvailabilitySlot([
					{
						startTime: at('03', '09:30'),
						endTime: at('03', '11:00'),
						employeeId: EMPLOYEE_B,
						organizationId: ORGANIZATION,
						type: 'Default',
						allDay: false
					}
				] as any)
			).rejects.toThrow();

			expect(await stored()).toEqual(colleagueSlots);
		});
	});
});
