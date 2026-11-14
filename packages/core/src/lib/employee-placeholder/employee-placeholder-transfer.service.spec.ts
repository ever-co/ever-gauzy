import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeePlaceholderTransferService } from './employee-placeholder-transfer.service';

/**
 * Claiming or merging a member without an account (ever-co/ever-gauzy#11913) runs for real on SQLite, against a
 * miniature of the tables that point at an employee: a team membership the database does not keep unique, a task
 * assignment whose primary key is the pair, a one-per-member setting, claim invitations, and a table no list in the
 * code names (as a plugin's would be). Everything moves to the member, nothing is duplicated, nothing is left pointing
 * at the removed placeholder, and a failure changes nothing.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const OTHER_ORGANIZATION = 'organization-2';

const AMINA = 'employee-amina';
const AMINA_USER = 'user-amina';
const MARIE = 'employee-marie';
const MARIE_USER = 'user-marie';
const PAUL = 'employee-paul';
const PAUL_USER = 'user-paul';

describe('EmployeePlaceholderTransferService on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;
	let service: EmployeePlaceholderTransferService;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-placeholder-transfer-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		for (const statement of SCHEMA) {
			await dataSource.query(statement);
		}
		for (const statement of FIXTURE) {
			await dataSource.query(statement);
		}
		service = new EmployeePlaceholderTransferService({ manager: dataSource.manager } as never);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const rows = async (sql: string, parameters: unknown[] = []) => (await dataSource.query(sql, parameters)) as any[];

	/** Every row of the fixture's tables that still points at an employee. */
	const pointingAt = async (employeeId: string) => {
		const found: string[] = [];
		for (const [table, column] of REFERENCES) {
			const [{ total }] = await rows(`SELECT COUNT(*) AS total FROM "${table}" WHERE "${column}" = ?`, [
				employeeId
			]);
			if (Number(total) > 0) {
				found.push(`${table}.${column}`);
			}
		}
		return found;
	};

	it('moves every entry, timesheet, assignment and team to the member, then removes the placeholder and its user', async () => {
		const summary = await service.transfer(AMINA, MARIE, TENANT, { keepInviteId: 'invite-accepted' });

		expect(summary).toEqual({
			timeLogs: 2,
			duration: 5400,
			timesheets: 1,
			taskAssignments: 2,
			teams: [
				{ id: 'team-a', name: 'Design' },
				{ id: 'team-b', name: 'Support' }
			]
		});
		expect(await pointingAt(AMINA)).toEqual([]);
		expect(await rows(`SELECT "id" FROM "employee" WHERE "id" = ?`, [AMINA])).toEqual([]);
		// Retired rather than deleted: deleting a user makes the database check every table naming one.
		const [aminaUser] = await rows(`SELECT "deletedAt", "isActive", "isArchived" FROM "user" WHERE "id" = ?`, [
			AMINA_USER
		]);
		expect(aminaUser).toMatchObject({ isActive: 0, isArchived: 1, deletedAt: expect.any(String) });
		const [marieUser] = await rows(`SELECT "deletedAt", "isActive" FROM "user" WHERE "id" = ?`, [MARIE_USER]);
		expect(marieUser).toEqual({ deletedAt: null, isActive: 1 });

		const marieLogs = await rows(`SELECT "id" FROM "time_log" WHERE "employeeId" = ? ORDER BY "id"`, [MARIE]);
		expect(marieLogs.map((log) => log.id)).toEqual(['log-amina-1', 'log-amina-2', 'log-marie']);
		expect(await rows(`SELECT "id" FROM "timesheet" WHERE "employeeId" = ?`, [MARIE])).toHaveLength(1);
		expect(await rows(`SELECT "id" FROM "extension_note" WHERE "employeeId" = ?`, [MARIE])).toHaveLength(1);
	});

	it('keeps the member once in a team and on a task both already had, and their own one-per-member setting', async () => {
		await service.transfer(AMINA, MARIE, TENANT);

		const teams = await rows(
			`SELECT "organizationTeamId" AS team FROM "organization_team_employee" WHERE "employeeId" = ? ORDER BY 1`,
			[MARIE]
		);
		expect(teams.map((it) => it.team)).toEqual(['team-a', 'team-b']);
		const tasks = await rows(`SELECT "taskId" AS task FROM "task_employee" WHERE "employeeId" = ? ORDER BY 1`, [
			MARIE
		]);
		expect(tasks.map((it) => it.task)).toEqual(['task-1', 'task-2']);
		const settings = await rows(`SELECT "id" FROM "employee_notification_setting" WHERE "employeeId" = ?`, [MARIE]);
		expect(settings).toEqual([{ id: 'setting-marie' }]);
	});

	it('fills only the rates the member does not have, a value with its currency', async () => {
		await service.transfer(AMINA, MARIE, TENANT);

		const [marie] = await rows(
			`SELECT "billRateValue", "billRateCurrency", "payRateValue", "payRateCurrency" FROM "employee" WHERE "id" = ?`,
			[MARIE]
		);
		expect(marie).toEqual({ billRateValue: 40, billRateCurrency: 'USD', payRateValue: 20, payRateCurrency: 'EUR' });
	});

	it('keeps the claim being accepted, removes the other pending ones, and clears what pointed at the placeholder', async () => {
		await service.transfer(AMINA, MARIE, TENANT, { keepInviteId: 'invite-accepted' });

		const invites = await rows(`SELECT "id", "placeholderEmployeeId" AS link FROM "invite" ORDER BY "id"`);
		expect(invites).toEqual([
			{ id: 'invite-accepted', link: null },
			{ id: 'invite-regular', link: null }
		]);
	});

	it('previews what would move and the entries that overlap the member, writing nothing', async () => {
		const preview = await service.preview(AMINA, MARIE, TENANT);

		expect(preview).toMatchObject({
			placeholderEmployeeId: AMINA,
			targetEmployeeId: MARIE,
			timeLogs: 2,
			duration: 5400,
			overlappingTimeLogs: 1
		});
		expect(await pointingAt(AMINA)).toEqual(REFERENCES.map(([table, column]) => `${table}.${column}`));
	});

	it('refuses a member with an account as the placeholder, a placeholder as the member, and another organization', async () => {
		await expect(service.transfer(MARIE, AMINA, TENANT)).rejects.toBeInstanceOf(BadRequestException);
		await dataSource.query(`UPDATE "employee" SET "isPlaceholder" = 1 WHERE "id" = ?`, [MARIE]);
		await expect(service.transfer(AMINA, MARIE, TENANT)).rejects.toBeInstanceOf(BadRequestException);
		await dataSource.query(`UPDATE "employee" SET "isPlaceholder" = 0 WHERE "id" = ?`, [MARIE]);

		await expect(service.transfer(AMINA, PAUL, TENANT)).rejects.toBeInstanceOf(ConflictException);
		await expect(service.transfer(AMINA, MARIE, 'another-tenant')).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.transfer(AMINA, AMINA, TENANT)).rejects.toBeInstanceOf(BadRequestException);

		expect(await pointingAt(AMINA)).toEqual(REFERENCES.map(([table, column]) => `${table}.${column}`));
	});

	it("works without TypeORM's table reader, which fails on a Postgres table with a generated column", async () => {
		// The reader asks for TypeORM's own metadata table as soon as a table has a generated column; the database has
		// none, so the reader throws (and, inside a transaction, aborts it).
		const runner = dataSource.createQueryRunner();
		jest.spyOn(Object.getPrototypeOf(runner), 'getTables').mockRejectedValue(
			new Error('relation "typeorm_metadata" does not exist')
		);
		await runner.release();

		await expect(service.transfer(AMINA, MARIE, TENANT)).resolves.toMatchObject({ timeLogs: 2 });
		expect(await pointingAt(AMINA)).toEqual([]);
	});

	it('changes nothing when a step fails', async () => {
		// The last step, retiring the placeholder's user, is refused: the whole transfer is rolled back.
		await dataSource.query(
			`CREATE TRIGGER "refuse_user_change" BEFORE UPDATE ON "user" BEGIN SELECT RAISE(ABORT, 'refused'); END`
		);

		await expect(service.transfer(AMINA, MARIE, TENANT)).rejects.toThrow();

		expect(await pointingAt(AMINA)).toEqual(REFERENCES.map(([table, column]) => `${table}.${column}`));
		expect(await rows(`SELECT "id" FROM "employee" WHERE "id" = ?`, [AMINA])).toHaveLength(1);
	});
});

/** The columns of the fixture that point at an employee. */
const REFERENCES: Array<[string, string]> = [
	['employee_notification_setting', 'employeeId'],
	['extension_note', 'employeeId'],
	['invite', 'placeholderEmployeeId'],
	['organization_team_employee', 'employeeId'],
	['task_employee', 'employeeId'],
	['time_log', 'employeeId'],
	['timesheet', 'employeeId']
];

const SCHEMA = [
	`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "email" varchar,
		"isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`,
	`CREATE TABLE "employee" (
		"id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar,
		"userId" varchar REFERENCES "user" ("id") ON DELETE CASCADE,
		"isPlaceholder" boolean NOT NULL DEFAULT (0), "deletedAt" datetime,
		"billRateValue" numeric, "billRateCurrency" varchar, "minimumBillingRate" numeric,
		"payRateValue" numeric, "payRateCurrency" varchar, "payPeriod" varchar)`,
	`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar)`,
	// As in the real database: nothing keeps a member unique in a team.
	`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL,
		"organizationTeamId" varchar REFERENCES "organization_team" ("id") ON DELETE CASCADE,
		"employeeId" varchar REFERENCES "employee" ("id") ON DELETE CASCADE)`,
	`CREATE TABLE "task_employee" ("taskId" varchar NOT NULL,
		"employeeId" varchar NOT NULL REFERENCES "employee" ("id") ON DELETE CASCADE, PRIMARY KEY ("taskId", "employeeId"))`,
	`CREATE TABLE "time_log" ("id" varchar PRIMARY KEY NOT NULL,
		"employeeId" varchar REFERENCES "employee" ("id") ON DELETE CASCADE,
		"startedAt" datetime, "stoppedAt" datetime, "deletedAt" datetime)`,
	`CREATE TABLE "timesheet" ("id" varchar PRIMARY KEY NOT NULL,
		"employeeId" varchar REFERENCES "employee" ("id") ON DELETE CASCADE, "deletedAt" datetime)`,
	`CREATE TABLE "employee_notification_setting" ("id" varchar PRIMARY KEY NOT NULL,
		"employeeId" varchar UNIQUE REFERENCES "employee" ("id") ON DELETE CASCADE)`,
	`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar, "status" varchar,
		"placeholderEmployeeId" varchar REFERENCES "employee" ("id") ON DELETE SET NULL)`,
	// A table no list in the code names, as a plugin's would be: it must move as well.
	`CREATE TABLE "extension_note" ("id" varchar PRIMARY KEY NOT NULL, "employeeId" varchar REFERENCES "employee" ("id"))`,
	`CREATE TABLE "user_note" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar REFERENCES "user" ("id"))`
];

const FIXTURE = [
	`INSERT INTO "user" ("id", "tenantId", "email") VALUES ('${AMINA_USER}', '${TENANT}', NULL), ('${MARIE_USER}', '${TENANT}', 'marie@ever.co'), ('${PAUL_USER}', '${TENANT}', 'paul@ever.co')`,
	`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "isPlaceholder", "billRateValue", "billRateCurrency")
		VALUES ('${AMINA}', '${TENANT}', '${ORGANIZATION}', '${AMINA_USER}', 1, 40, 'USD')`,
	`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "isPlaceholder", "payRateValue", "payRateCurrency")
		VALUES ('${MARIE}', '${TENANT}', '${ORGANIZATION}', '${MARIE_USER}', 0, 20, 'EUR')`,
	`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "isPlaceholder")
		VALUES ('${PAUL}', '${TENANT}', '${OTHER_ORGANIZATION}', '${PAUL_USER}', 0)`,
	`INSERT INTO "organization_team" VALUES ('team-a', 'Design'), ('team-b', 'Support')`,
	`INSERT INTO "organization_team_employee" VALUES ('member-amina-a', 'team-a', '${AMINA}'), ('member-amina-b', 'team-b', '${AMINA}'), ('member-marie-b', 'team-b', '${MARIE}')`,
	`INSERT INTO "task_employee" VALUES ('task-1', '${AMINA}'), ('task-2', '${AMINA}'), ('task-2', '${MARIE}')`,
	`INSERT INTO "time_log" VALUES ('log-amina-1', '${AMINA}', '2026-11-02 09:00:00.000', '2026-11-02 10:00:00.000', NULL),
		('log-amina-2', '${AMINA}', '2026-11-03 09:00:00.000', '2026-11-03 09:30:00.000', NULL),
		('log-marie', '${MARIE}', '2026-11-03 09:15:00.000', '2026-11-03 11:00:00.000', NULL)`,
	`INSERT INTO "timesheet" VALUES ('timesheet-amina', '${AMINA}', NULL)`,
	`INSERT INTO "employee_notification_setting" VALUES ('setting-amina', '${AMINA}'), ('setting-marie', '${MARIE}')`,
	`INSERT INTO "invite" VALUES ('invite-accepted', 'amina@example.com', 'INVITED', '${AMINA}'),
		('invite-other-claim', 'amina.k@example.com', 'INVITED', '${AMINA}'),
		('invite-regular', 'someone@example.com', 'INVITED', NULL)`,
	`INSERT INTO "extension_note" VALUES ('note-amina', '${AMINA}')`
];
