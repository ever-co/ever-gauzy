jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	getConfig: () => ({ dbConnectionOptions: { type: 'better-sqlite3' } }),
	isMySQL: () => false
}));

import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { RecountProjectMembersOfWorkingEmployees1791000003430 } from '../database/migrations/1791000003430-RecountProjectMembersOfWorkingEmployees';
import { recountMembersOfEmployeeProjects } from './organization-project-members-count';
import { OrganizationProjectSubscriber } from './organization-project.subscriber';

/**
 * `membersCount` counts the members who still work in the organization. Run for real on SQLite (the demo database)
 * against a minimal fixture: two working members, one whose work ended (End Work sets `isActive = false`,
 * `isArchived = true`) and one deleted employee, on one project; a second project of the employee whose work ended.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const PROJECT = 'project-1';
const OTHER_PROJECT = 'project-2';

describe('organization project members count, on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-project-members-count-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();

		await dataSource.query(
			'CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)'
		);
		await dataSource.query(
			'CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "membersCount" integer DEFAULT (0))'
		);
		await dataSource.query(
			'CREATE TABLE "organization_project_employee" ("id" varchar PRIMARY KEY NOT NULL, "organizationProjectId" varchar NOT NULL, "employeeId" varchar NOT NULL)'
		);

		await dataSource.query(`INSERT INTO "employee" ("id", "isActive", "isArchived", "deletedAt") VALUES
			('working-1', 1, 0, NULL),
			('working-2', 1, 0, NULL),
			('ended', 0, 1, NULL),
			('deleted', 1, 0, '2026-01-01 00:00:00')`);
		await dataSource.query(
			`INSERT INTO "organization_project" ("id", "tenantId", "organizationId", "membersCount") VALUES (?, ?, ?, 4), (?, ?, ?, 1)`,
			[PROJECT, TENANT, ORGANIZATION, OTHER_PROJECT, TENANT, ORGANIZATION]
		);
		await dataSource.query(`INSERT INTO "organization_project_employee" ("id", "organizationProjectId", "employeeId") VALUES
			('m1', '${PROJECT}', 'working-1'),
			('m2', '${PROJECT}', 'working-2'),
			('m3', '${PROJECT}', 'ended'),
			('m4', '${PROJECT}', 'deleted'),
			('m5', '${OTHER_PROJECT}', 'ended')`);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const counts = async () =>
		Object.fromEntries(
			(
				(await dataSource.query(
					'SELECT "id", "membersCount" FROM "organization_project" ORDER BY "id"'
				)) as Array<{
					id: string;
					membersCount: number;
				}>
			).map(({ id, membersCount }) => [id, Number(membersCount)])
		);

	const runMigration = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new RecountProjectMembersOfWorkingEmployees1791000003430()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	it('the migration recounts every project with its working members, and down counts every membership again', async () => {
		await runMigration('up');
		expect(await counts()).toEqual({ [PROJECT]: 2, [OTHER_PROJECT]: 0 });

		// Running it again changes nothing
		await runMigration('up');
		expect(await counts()).toEqual({ [PROJECT]: 2, [OTHER_PROJECT]: 0 });

		await runMigration('down');
		expect(await counts()).toEqual({ [PROJECT]: 4, [OTHER_PROJECT]: 1 });
	});

	it('the subscriber counts the working members when a project is saved', async () => {
		await new OrganizationProjectSubscriber().updateProjectMembersCount(
			{ id: PROJECT, organizationId: ORGANIZATION, tenantId: TENANT } as never,
			dataSource.manager
		);

		expect((await counts())[PROJECT]).toBe(2);
	});

	it('recounts the projects of an employee whose work ended, and again when they are back to work', async () => {
		await runMigration('up');

		// Back to Work: the employee counts again in both of their projects
		await dataSource.query(`UPDATE "employee" SET "isActive" = 1, "isArchived" = 0 WHERE "id" = 'ended'`);
		await recountMembersOfEmployeeProjects(dataSource.manager, 'ended');
		expect(await counts()).toEqual({ [PROJECT]: 3, [OTHER_PROJECT]: 1 });

		// End Work: they are no longer counted
		await dataSource.query(`UPDATE "employee" SET "isActive" = 0, "isArchived" = 1 WHERE "id" = 'ended'`);
		await recountMembersOfEmployeeProjects(dataSource.manager, 'ended');
		expect(await counts()).toEqual({ [PROJECT]: 2, [OTHER_PROJECT]: 0 });
	});

	it('leaves the projects the employee is not a member of as they are', async () => {
		await dataSource.query(`UPDATE "organization_project" SET "membersCount" = 99 WHERE "id" = ?`, [OTHER_PROJECT]);
		await dataSource.query(`DELETE FROM "organization_project_employee" WHERE "id" = 'm5'`);

		await recountMembersOfEmployeeProjects(dataSource.manager, 'working-1');

		expect(await counts()).toEqual({ [PROJECT]: 2, [OTHER_PROJECT]: 99 });
	});
});
