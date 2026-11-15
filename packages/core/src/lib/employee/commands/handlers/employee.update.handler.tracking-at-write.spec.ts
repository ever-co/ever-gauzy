// Only the shape of the services is needed: the real ones pull the whole core entity graph in.
jest.mock('./../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../../../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));

/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../../../core/entities/internal';

import { EmployeeKindEnum, IEmployeeUpdateInput, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { RequestContext } from './../../../core/context';
import { Organization } from './../../../core/entities/internal';
import { MultiORMEnum } from './../../../core/utils';
import * as membersCount from './../../../organization-project/organization-project-members-count';
import * as screenshotCaptureDefault from './../../employee-screenshot-capture-default';
import { Employee } from './../../employee.entity';
import { EmployeeSubscriber } from './../../employee.subscriber';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeUpdateHandler } from './employee.update.handler';

/**
 * Follow-up of ever-co/ever-gauzy#11959. Where the organization restricts the tracking switch to higher roles, the
 * handler lets someone who may not turn an employee's tracking on or off change their work dates only when the dates
 * leave the tracking as the handler read it. The employee subscriber then derives the switch from the dates when the
 * row is written, a few milliseconds later: an admin's switch landing in between was undone by a change the check had
 * read as harmless. The derived switch of such a caller now leaves the tracking as the row holds it when written.
 *
 * A real better-sqlite database with the real `EmployeeSubscriber`; the service saves as `CrudService.create` does
 * under TypeORM (`repository.save(repository.create(…))`), and an admin's switch, from another request, is committed
 * between the handler's read and that save.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const SELF = 'employee-self';
const STORED_START = new Date('2026-01-05T00:00:00.000Z');
const NEW_START = new Date('2026-11-02T00:00:00.000Z');
const NEW_END = new Date('2026-11-14T00:00:00.000Z');

const EmployeeSchema = new EntitySchema<Employee>({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		kind: { type: 'varchar', default: EmployeeKindEnum.HUMAN },
		allowScreenshotCapture: { type: 'boolean', default: true },
		startedWorkOn: { type: 'datetime', nullable: true },
		endWork: { type: 'datetime', nullable: true },
		isActive: { type: 'boolean', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		isTrackingEnabled: { type: 'boolean', nullable: true },
		short_description: { type: 'varchar', nullable: true }
	} as any
});

const OrganizationSchema = new EntitySchema<Organization>({
	name: 'Organization',
	target: Organization,
	tableName: 'organization',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		allowScreenshotCapture: { type: 'boolean' },
		totalEmployees: { type: 'integer', default: 0 }
	}
});

describe('EmployeeUpdateHandler — the work dates switch the tracking as the row stands when written (TypeORM)', () => {
	const previousOrm = process.env.DB_ORM;

	let dataSource: DataSource;
	let employees: Repository<Employee>;
	let restricted: boolean;
	/** The switch an admin commits from another request while this one is between its read and its save. */
	let adminSwitchesTo: boolean | undefined;
	let handler: EmployeeUpdateHandler;

	beforeAll(async () => {
		process.env.DB_ORM = MultiORMEnum.TypeORM;
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [EmployeeSchema, OrganizationSchema],
			subscribers: [EmployeeSubscriber],
			synchronize: true,
			logging: false,
			// As the application configures it (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		employees = dataSource.getRepository(Employee);
		await dataSource
			.getRepository(Organization)
			.insert({ id: ORG, tenantId: TENANT, allowScreenshotCapture: true } as Organization);
	});

	afterAll(async () => {
		await dataSource?.destroy();
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	beforeEach(async () => {
		// Starting or ending work also updates the membership and recounts the projects' members: their own specs.
		jest.spyOn(EmployeeSubscriber.prototype, 'setUserOrganizationStatus').mockResolvedValue(undefined);
		jest.spyOn(membersCount, 'recountMembersOfEmployeeProjects').mockResolvedValue(undefined);
		await employees.clear();
		restricted = true;
		adminSwitchesTo = undefined;

		const service = {
			// The employee as the handler reads it, with their organization and their user's role.
			findOneByIdString: async (id: string) => ({
				...(await employees.findOneByOrFail({ id })),
				organization: { id: ORG, restrictTrackingSwitchToHigherRoles: restricted },
				user: { id: `user-of-${id}`, role: { name: RolesEnum.EMPLOYEE } }
			}),
			create: async (entity: Partial<Employee>) => {
				if (adminSwitchesTo !== undefined) {
					// Another request's write, committed after this one's read: no subscriber of this request sees it.
					await dataSource.query('UPDATE "employee" SET "isTrackingEnabled" = ? WHERE "id" = ?', [
						adminSwitchesTo ? 1 : 0,
						entity.id
					]);
				}
				// As `CrudService.create` saves under TypeORM.
				return await employees.save(employees.create(entity));
			}
		};
		handler = new EmployeeUpdateHandler(service as never, {} as never, { publish: jest.fn() } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The caller: the user of `employeeId`, holding `role`; ORG_EMPLOYEES_EDIT only for an admin. */
	const asCaller = (role: RolesEnum, employeeId: string) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: `user-of-${employeeId}`,
			employeeId,
			role: { name: role }
		} as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) =>
				permission === PermissionsEnum.PROFILE_EDIT ||
				(role === RolesEnum.ADMIN && permission === PermissionsEnum.ORG_EMPLOYEES_EDIT)
		);
	};

	/** The stored row as given: without the listeners, whose create hook would start work from the start date. */
	const storeEmployee = (values: Partial<Employee>) =>
		dataSource
			.createQueryBuilder()
			.insert()
			.into(Employee)
			.values({
				id: SELF,
				tenantId: TENANT,
				organizationId: ORG,
				startedWorkOn: STORED_START,
				endWork: null,
				isActive: true,
				isArchived: false,
				...values
			} as Employee)
			.callListeners(false)
			.execute();

	const save = (input: Record<string, unknown>) =>
		handler.execute(new EmployeeUpdateCommand(SELF, input as IEmployeeUpdateInput));

	const stored = () => employees.findOneByOrFail({ id: SELF });

	it("keeps an admin's switch off made after the check, under the employee's own start date change", async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		await storeEmployee({ isTrackingEnabled: true });
		adminSwitchesTo = false;

		await save({ startedWorkOn: NEW_START });

		const row = await stored();
		expect(row.startedWorkOn).toEqual(NEW_START);
		expect(row.isTrackingEnabled).toBe(false);
	});

	it("keeps an admin's switch on made after the check, under the employee's own end date", async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		await storeEmployee({ isTrackingEnabled: false });
		adminSwitchesTo = true;

		await save({ endWork: NEW_END });

		const row = await stored();
		expect(row.endWork).toEqual(NEW_END);
		expect(row.isArchived).toBe(true);
		expect(row.isTrackingEnabled).toBe(true);
	});

	it('still lets an admin turn the tracking on through the start date', async () => {
		asCaller(RolesEnum.ADMIN, 'employee-admin');
		await storeEmployee({ isTrackingEnabled: false });

		await save({ startedWorkOn: NEW_START });

		expect(await stored()).toMatchObject({ startedWorkOn: NEW_START, isTrackingEnabled: true });
	});

	it('still turns the tracking on through the start date where the organization does not restrict the switch', async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		await storeEmployee({ isTrackingEnabled: false });
		restricted = false;

		await save({ startedWorkOn: NEW_START });

		expect(await stored()).toMatchObject({ startedWorkOn: NEW_START, isTrackingEnabled: true });
	});

	it('leaves the tracking as it is when the employee changes their start date and no one switched it', async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		await storeEmployee({ isTrackingEnabled: true });

		await save({ startedWorkOn: NEW_START, short_description: 'Edited' });

		expect(await stored()).toMatchObject({
			startedWorkOn: NEW_START,
			short_description: 'Edited',
			isTrackingEnabled: true,
			isActive: true
		});
	});
});

/** The columns the subscriber reads and writes, mapped onto the real class for MikroORM. */
const MikroOrmEmployeeSchema = new MikroOrmEntitySchema<Employee>({
	class: Employee,
	tableName: 'employee',
	properties: {
		id: { type: 'string', primary: true },
		tenantId: { type: 'string' },
		organizationId: { type: 'string' },
		allowScreenshotCapture: { type: 'boolean', nullable: true },
		startedWorkOn: { type: 'Date', nullable: true },
		endWork: { type: 'Date', nullable: true },
		isActive: { type: 'boolean', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		isTrackingEnabled: { type: 'boolean', nullable: true },
		// Read by the soft-delete filter every employee read carries.
		deletedAt: { type: 'Date', nullable: true }
	} as any
});

/**
 * The same write under MikroORM, where `CrudService.create` loads the row, assigns the changes and flushes. Here the
 * write's unit of work reads the row afresh, after the admin's switch, as a request whose identity map does not
 * already hold the employee does: the flush then wrote the switch the subscriber derived from the dates.
 */
describe('EmployeeUpdateHandler — the work dates switch the tracking as the row stands when written (MikroORM)', () => {
	const previousOrm = process.env.DB_ORM;

	let orm: MikroORM<BetterSqliteDriver>;
	let adminSwitchesTo: boolean | undefined;
	let publish: jest.Mock;
	let handler: EmployeeUpdateHandler;

	beforeAll(async () => {
		process.env.DB_ORM = MultiORMEnum.MikroORM;
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [MikroOrmEmployeeSchema],
			subscribers: [new EmployeeSubscriber()],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.em.getConnection().execute(
			`CREATE TABLE employee (id varchar PRIMARY KEY NOT NULL, tenantId varchar, organizationId varchar,
				allowScreenshotCapture boolean, startedWorkOn datetime, endWork datetime, isActive boolean,
				isArchived boolean, isTrackingEnabled boolean, createdAt datetime, updatedAt datetime,
				deletedAt datetime)`
		);
	});

	afterAll(async () => {
		await orm?.close(true);
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	beforeEach(async () => {
		jest.spyOn(EmployeeSubscriber.prototype, 'setUserOrganizationStatus').mockResolvedValue(undefined);
		jest.spyOn(membersCount, 'recountMembersOfEmployeeProjects').mockResolvedValue(undefined);
		// The organization's screen capture setting has its own spec.
		jest.spyOn(screenshotCaptureDefault, 'readOrganizationScreenshotCapture').mockResolvedValue(true);
		await orm.em.getConnection().execute('DELETE FROM employee');
		adminSwitchesTo = undefined;

		const service = {
			findOneByIdString: async (id: string) => ({
				...(await orm.em.fork().findOneOrFail(Employee, { id })),
				organization: { id: ORG, restrictTrackingSwitchToHigherRoles: true },
				user: { id: `user-of-${id}`, role: { name: RolesEnum.EMPLOYEE } }
			}),
			create: async ({ id, ...changes }: Partial<Employee>) => {
				if (adminSwitchesTo !== undefined) {
					await orm.em
						.getConnection()
						.execute('UPDATE employee SET isTrackingEnabled = ? WHERE id = ?', [
							adminSwitchesTo ? 1 : 0,
							id
						]);
				}
				// As `CrudService.create` updates a stored row under MikroORM.
				const em = orm.em.fork();
				const entity = await em.findOneOrFail(Employee, { id });
				em.assign(entity, changes as never, { updateNestedEntities: false, onlyOwnProperties: true });
				await em.flush();
				return entity;
			}
		};
		publish = jest.fn();
		handler = new EmployeeUpdateHandler(service as never, {} as never, { publish } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	const asCaller = (role: RolesEnum, employeeId: string) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: `user-of-${employeeId}`,
			employeeId,
			role: { name: role }
		} as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) =>
				permission === PermissionsEnum.PROFILE_EDIT ||
				(role === RolesEnum.ADMIN && permission === PermissionsEnum.ORG_EMPLOYEES_EDIT)
		);
	};

	const storeEmployee = (isTrackingEnabled: boolean) =>
		orm.em
			.getConnection()
			.execute(
				'INSERT INTO employee (id, tenantId, organizationId, allowScreenshotCapture, startedWorkOn, endWork, isActive, isArchived, isTrackingEnabled) VALUES (?, ?, ?, 1, ?, NULL, 1, 0, ?)',
				[SELF, TENANT, ORG, STORED_START.getTime(), isTrackingEnabled ? 1 : 0]
			);

	const save = (input: Record<string, unknown>) =>
		handler.execute(new EmployeeUpdateCommand(SELF, input as IEmployeeUpdateInput));

	const stored = () => orm.em.fork().findOneOrFail(Employee, { id: SELF });

	it("keeps an admin's switch off made after the check, under the employee's own start date change", async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		await storeEmployee(true);
		adminSwitchesTo = false;

		await save({ startedWorkOn: NEW_START });

		const row = await stored();
		expect(row.startedWorkOn).toEqual(NEW_START);
		expect(row.isTrackingEnabled).toBe(false);
	});

	it("publishes no stop of its own for the admin's switch off, which published its own", async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		await storeEmployee(true);
		adminSwitchesTo = false;

		const saved = await save({ startedWorkOn: NEW_START });

		// The saved row shows the admin's "off" while the handler read "on": that stop is not this save's.
		expect(saved.isTrackingEnabled).toBe(false);
		expect(publish).not.toHaveBeenCalled();
	});

	it('still lets an admin turn the tracking on through the start date', async () => {
		asCaller(RolesEnum.ADMIN, 'employee-admin');
		await storeEmployee(false);

		await save({ startedWorkOn: NEW_START });

		expect(await stored()).toMatchObject({ startedWorkOn: NEW_START, isTrackingEnabled: true });
	});

	it('still publishes the stop of an admin who ends the work, which turns the tracking off', async () => {
		asCaller(RolesEnum.ADMIN, 'employee-admin');
		await storeEmployee(true);

		await save({ endWork: NEW_END });

		expect(await stored()).toMatchObject({ endWork: NEW_END, isTrackingEnabled: false });
		expect(publish).toHaveBeenCalledTimes(1);
	});
});
