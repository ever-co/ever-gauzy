import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * A save under the tracking switch its screen showed (`expectedIsTrackingEnabled`, ever-co/ever-gauzy#11830), on both
 * ORMs, over one database whose tables TypeORM created.
 *
 * The switch was compared before the write, not with it (Greptile on ever-co/ever-gauzy#12039): another admin's switch
 * saved after the check was then undone by a save that still went through, for example tracking turned back on by a
 * save sending the switch as its screen showed it. The comparison is now made again in the write's own transaction, on
 * the row read under lock, and a switch saved in between refuses the save with 409, nothing written.
 *
 * The real services write: `OrganizationTeamEmployeeService.updateMember` (`PUT /organization-team-employee/:id`) and
 * `EmployeeUpdateHandler` with the real `EmployeeService` (`PUT /employee/:id`). Another admin's switch is committed
 * right after the request's check has read the row, before its write. SQLite locks no rows, so this is the window the
 * test can open: the comparison made with the write is what is under test, the row lock being PostgreSQL's and
 * MySQL's (see `writeUnderTrackingSwitchAsSeen`).
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '12039000-0000-4000-8000-00000000a001';
const ORG = '12039000-0000-4000-8000-00000000b001';
const ADMIN_USER = '12039000-0000-4000-8000-00000000c001';
const MEMBER_USER = '12039000-0000-4000-8000-00000000c002';
const EMPLOYEE = '12039000-0000-4000-8000-00000000d001';
const TEAM = '12039000-0000-4000-8000-00000000e001';
const MEMBERSHIP = '12039000-0000-4000-8000-00000000f001';

const scope = { tenantId: TENANT, organizationId: ORG };

describe('A save under the tracking switch its screen showed, on TypeORM and on MikroORM (#12039)', () => {
	const file = path.join(os.tmpdir(), `gauzy-tracking-switch-as-seen-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let publish: jest.Mock;

	/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
	const insert = async (table: string, row: Row): Promise<void> => {
		const columns: Row[] = await dataSource.query(`PRAGMA table_info("${table}")`);
		const values: Row = { ...row };
		for (const column of columns) {
			const isGiven = column.name in values;
			const takesNoPlaceholder = !column.notnull || column.dflt_value !== null || column.pk;
			if (isGiven || takesNoPlaceholder) continue;
			values[column.name] = placeholderFor(String(column.type));
		}
		const keys = Object.keys(values);
		const names = keys.map((key) => `"${key}"`).join(', ');
		const marks = keys.map(() => '?').join(', ');
		await dataSource.query(
			`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
			keys.map((key) => values[key])
		);
	};

	/** Another admin's switch, committed by another request: no subscriber nor identity map of this one sees it. */
	const switchedMeanwhile = (table: string, id: string, isTrackingEnabled: boolean) => async () => {
		await dataSource.query(`UPDATE "${table}" SET "isTrackingEnabled" = ? WHERE "id" = ?`, [
			isTrackingEnabled ? 1 : 0,
			id
		]);
	};

	/**
	 * Runs `meanwhile` once, right after the first call of the method named has read: the request's check of the
	 * switch, which reads the row before anything is written.
	 */
	const afterFirstRead = (target: Row, method: string, meanwhile?: () => Promise<void>): void => {
		if (!meanwhile) return;
		const read = target[method];
		let reads = 0;
		target[method] = async function (this: unknown, ...args: unknown[]) {
			const result = await read.apply(this, args);
			reads += 1;
			if (reads === 1) {
				await meanwhile();
			}
			return result;
		};
	};

	/** The refusal a promise ends with, or null when it was kept. */
	const refusalOf = (save: Promise<unknown>): Promise<any> =>
		save.then(
			() => null,
			(refusal) => refusal
		);

	const expectTrackingSwitchChanged = (refusal: any) => {
		expect(refusal).not.toBeNull();
		expect(refusal.getStatus?.()).toBe(409);
		expect(refusal.getResponse().code).toBe('TRACKING_SWITCH_CHANGED');
	};

	const asBoolean = (value: unknown): boolean | null => (value === null || value === undefined ? null : !!value);

	/** The team member service, on the ORM named. */
	const teamService = (ormType: Orm) => {
		const service = new loaded.OrganizationTeamEmployeeService(
			new loaded.TypeOrmOrganizationTeamEmployeeRepository(
				dataSource.getRepository(loaded.OrganizationTeamEmployee)
			),
			new loaded.MikroOrmOrganizationTeamEmployeeRepository(orm.em, loaded.OrganizationTeamEmployee),
			{ publish },
			{},
			{}
		);
		Object.defineProperty(service, 'ormType', { get: () => ormType });
		return service;
	};

	/** `PUT /organization-team-employee/:id`, with another admin's switch committed after the check, if any. */
	const updateMember = (ormType: Orm, body: Row, meanwhile?: () => Promise<void>) => {
		const service = teamService(ormType);
		afterFirstRead(service, 'findOneByWhereOptions', meanwhile);
		return service.updateMember(MEMBERSHIP, { ...scope, organizationTeamId: TEAM, ...body });
	};

	const membershipRow = async (): Promise<{ isTrackingEnabled: boolean | null; order: number | null }> => {
		const [row] = await dataSource.query(
			`SELECT "isTrackingEnabled", "order" FROM "organization_team_employee" WHERE "id" = ?`,
			[MEMBERSHIP]
		);
		return { isTrackingEnabled: asBoolean(row.isTrackingEnabled), order: row.order };
	};

	/** `PUT /employee/:id` through its handler and the real employee service, on the ORM named. */
	const updateEmployee = (ormType: Orm, body: Row, meanwhile?: () => Promise<void>) => {
		const service = new loaded.EmployeeService(
			new loaded.TypeOrmEmployeeRepository(dataSource.getRepository(loaded.Employee)),
			new loaded.MikroOrmEmployeeRepository(orm.em, loaded.Employee)
		);
		Object.defineProperty(service, 'ormType', { get: () => ormType });
		afterFirstRead(service, 'findOneByIdString', meanwhile);
		const handler = new loaded.EmployeeUpdateHandler(service, {}, { publish });
		return handler.execute(new loaded.EmployeeUpdateCommand(EMPLOYEE, { ...scope, ...body }));
	};

	const employeeRow = async (): Promise<{ isTrackingEnabled: boolean | null; short_description: string | null }> => {
		const [row] = await dataSource.query(
			`SELECT "isTrackingEnabled", "short_description" FROM "employee" WHERE "id" = ?`,
			[EMPLOYEE]
		);
		return { isTrackingEnabled: asBoolean(row.isTrackingEnabled), short_description: row.short_description };
	};

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
				require('@mikro-orm/core').MetadataStorage.clear();

				// Must be first: loads the entity graph before a service pulls an entity.
				const entities = require('../../core/entities/internal');

				const { coreEntities } = require('../../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM } = require('@mikro-orm/core');
				const { dbMikroOrmConnectionConfig, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } = require('@gauzy/config');

				loaded = {
					Employee: entities.Employee,
					OrganizationTeamEmployee: entities.OrganizationTeamEmployee,
					PermissionsEnum: require('@gauzy/contracts').PermissionsEnum,
					RolesEnum: require('@gauzy/contracts').RolesEnum,
					RequestContext: require('../../core/context/request-context').RequestContext,
					OrganizationTeamEmployeeService: require('../../organization-team-employee/organization-team-employee.service')
						.OrganizationTeamEmployeeService,
					TypeOrmOrganizationTeamEmployeeRepository:
						require('../../organization-team-employee/repository/type-orm-organization-team-employee.repository')
							.TypeOrmOrganizationTeamEmployeeRepository,
					MikroOrmOrganizationTeamEmployeeRepository:
						require('../../organization-team-employee/repository/mikro-orm-organization-team-employee.repository')
							.MikroOrmOrganizationTeamEmployeeRepository,
					EmployeeService: require('../../employee/employee.service').EmployeeService,
					TypeOrmEmployeeRepository: require('../../employee/repository/type-orm-employee.repository')
						.TypeOrmEmployeeRepository,
					MikroOrmEmployeeRepository: require('../../employee/repository/mikro-orm-employee.repository')
						.MikroOrmEmployeeRepository,
					EmployeeUpdateCommand: require('../../employee/commands/employee.update.command').EmployeeUpdateCommand,
					EmployeeUpdateHandler: require('../../employee/commands/handlers/employee.update.handler')
						.EmployeeUpdateHandler
				};

				dataSource = new DataSource({
					type: 'better-sqlite3',
					database: file,
					entities: coreEntities,
					synchronize: true,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				orm = await MikroORM.init({
					...dbMikroOrmConnectionConfig,
					dbName: file,
					entities: coreEntities,
					allowGlobalContext: true,
					colors: false,
					debug: false,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}

		await dataSource.query('PRAGMA foreign_keys = OFF');
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('organization', { id: ORG, name: 'organization', tenantId: TENANT, currency: 'EUR' });
		await insert('user', { id: ADMIN_USER, tenantId: TENANT, firstName: 'Grace', lastName: 'Hopper' });
		await insert('user', { id: MEMBER_USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
		await insert('employee', { id: EMPLOYEE, ...scope, userId: MEMBER_USER });
		await insert('organization_team', { id: TEAM, ...scope, name: 'team' });
		await insert('organization_team_employee', {
			id: MEMBERSHIP,
			...scope,
			organizationTeamId: TEAM,
			employeeId: EMPLOYEE
		});
		await dataSource.query('PRAGMA foreign_keys = ON');
	}, TIMEOUT);

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		try {
			fs.unlinkSync(file);
		} catch {
			// The file is the operating system's temporary directory's to reclaim.
		}
	});

	beforeEach(() => {
		// An admin, who may change any employee's switch and edit any team
		const granted = [
			loaded.PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			loaded.PermissionsEnum.ORG_EMPLOYEES_EDIT,
			loaded.PermissionsEnum.ALL_ORG_EDIT,
			loaded.PermissionsEnum.ORG_TEAM_EDIT
		];
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({
			id: ADMIN_USER,
			tenantId: TENANT,
			employeeId: null,
			lastOrganizationId: ORG,
			role: { name: loaded.RolesEnum.ADMIN }
		});
		jest.spyOn(context, 'currentUserId').mockReturnValue(ADMIN_USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(context, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(context, 'hasPermission').mockImplementation((permission: string) => granted.includes(permission));
		jest.spyOn(context, 'hasRoles').mockReturnValue(true);
		jest.spyOn(context, 'hasRole').mockReturnValue(false);
		publish = jest.fn();
		orm.em.clear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('on %s', (ormType) => {
		describe('PUT /organization-team-employee/:id', () => {
			const storeMembership = async (isTrackingEnabled: boolean) => {
				await dataSource.query(
					`UPDATE "organization_team_employee" SET "isTrackingEnabled" = ?, "order" = 1 WHERE "id" = ?`,
					[isTrackingEnabled ? 1 : 0, MEMBERSHIP]
				);
			};

			it("refuses a save that would turn tracking back on after another admin turned it off, and writes nothing", async () => {
				await storeMembership(true);

				const refusal = await refusalOf(
					updateMember(
						ormType,
						{ isTrackingEnabled: true, order: 3, expectedIsTrackingEnabled: true },
						switchedMeanwhile('organization_team_employee', MEMBERSHIP, false)
					)
				);

				expectTrackingSwitchChanged(refusal);
				expect(await membershipRow()).toEqual({ isTrackingEnabled: false, order: 1 });
			});

			it("refuses a save that would turn tracking off after another admin turned it on, and announces no stop", async () => {
				await storeMembership(false);

				const refusal = await refusalOf(
					updateMember(
						ormType,
						{ isTrackingEnabled: false, order: 3, expectedIsTrackingEnabled: false },
						switchedMeanwhile('organization_team_employee', MEMBERSHIP, true)
					)
				);

				expectTrackingSwitchChanged(refusal);
				expect(await membershipRow()).toEqual({ isTrackingEnabled: true, order: 1 });
				expect(publish).not.toHaveBeenCalled();
			});

			it('writes a save whose switch is still the one its screen showed, and announces the stop', async () => {
				await storeMembership(true);

				await updateMember(ormType, { isTrackingEnabled: false, order: 3, expectedIsTrackingEnabled: true });

				expect(await membershipRow()).toEqual({ isTrackingEnabled: false, order: 3 });
				expect(publish).toHaveBeenCalledTimes(1);
			});

			it('writes a save that does not say what its screen showed, as before', async () => {
				await storeMembership(true);

				await updateMember(
					ormType,
					{ isTrackingEnabled: true, order: 3 },
					switchedMeanwhile('organization_team_employee', MEMBERSHIP, false)
				);

				expect(await membershipRow()).toEqual({ isTrackingEnabled: true, order: 3 });
			});
		});

		describe('PUT /employee/:id', () => {
			const storeEmployee = async (isTrackingEnabled: boolean) => {
				await dataSource.query(
					`UPDATE "employee" SET "isTrackingEnabled" = ?, "short_description" = ? WHERE "id" = ?`,
					[isTrackingEnabled ? 1 : 0, 'as stored', EMPLOYEE]
				);
			};

			it("refuses a save that would turn tracking back on after another admin turned it off, and writes nothing", async () => {
				await storeEmployee(true);

				const refusal = await refusalOf(
					updateEmployee(
						ormType,
						{ isTrackingEnabled: true, short_description: 'edited', expectedIsTrackingEnabled: true },
						switchedMeanwhile('employee', EMPLOYEE, false)
					)
				);

				expectTrackingSwitchChanged(refusal);
				expect(await employeeRow()).toEqual({ isTrackingEnabled: false, short_description: 'as stored' });
			});

			it("refuses a save that would turn tracking off after another admin turned it on, and announces no stop", async () => {
				await storeEmployee(false);

				const refusal = await refusalOf(
					updateEmployee(
						ormType,
						{ isTrackingEnabled: false, short_description: 'edited', expectedIsTrackingEnabled: false },
						switchedMeanwhile('employee', EMPLOYEE, true)
					)
				);

				expectTrackingSwitchChanged(refusal);
				expect(await employeeRow()).toEqual({ isTrackingEnabled: true, short_description: 'as stored' });
				expect(publish).not.toHaveBeenCalled();
			});

			it('writes a save whose switch is still the one its screen showed, and announces the stop', async () => {
				await storeEmployee(true);

				await updateEmployee(ormType, {
					isTrackingEnabled: false,
					short_description: 'edited',
					expectedIsTrackingEnabled: true
				});

				expect(await employeeRow()).toEqual({ isTrackingEnabled: false, short_description: 'edited' });
				expect(publish).toHaveBeenCalledTimes(1);
			});

			it('writes a save that does not say what its screen showed, as before', async () => {
				await storeEmployee(true);

				await updateEmployee(
					ormType,
					{ isTrackingEnabled: true, short_description: 'edited' },
					switchedMeanwhile('employee', EMPLOYEE, false)
				);

				expect(await employeeRow()).toEqual({ isTrackingEnabled: true, short_description: 'edited' });
			});
		});
	});
});

function placeholderFor(type: string): unknown {
	const lowerCaseType = type.toLowerCase();
	const isNumeric = /int|bool|numeric|decimal|real|float/.test(lowerCaseType);
	if (isNumeric) {
		return 0;
	}
	const isTemporal = /date|time/.test(lowerCaseType);
	if (isTemporal) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}
