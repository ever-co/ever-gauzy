import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The public team page read on one SQLite database with the tables TypeORM creates: the relations the Teams app
 * asks for (`tasks`, `tasks.members`, `tasks.teams`, `tasks.tags`, `members`, `members.employee.user`) come back
 * filled in and filtered as before, the members' partial `select` applies, and no statement joins the task
 * assignees or the team members onto the team row (what multiplied the team into one row per
 * (task × assignee × tag × team member)).
 *
 * Same pattern as `daily-plan.service.relation-load.sqlite.spec.ts`: the entities are imported in an isolated
 * registry under `DB_ORM=typeorm`, everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';
const OTHER_TEAM = '33333333-3333-4333-8333-333333333334';
const USERS = ['44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442', '44444444-4444-4444-8444-444444444443'];
const EMPLOYEES = ['55555555-5555-4555-8555-555555555551', '55555555-5555-4555-8555-555555555552', '55555555-5555-4555-8555-555555555553'];
const TASKS = ['66666666-6666-4666-8666-666666666661', '66666666-6666-4666-8666-666666666662', '66666666-6666-4666-8666-666666666663'];
const TAGS = ['77777777-7777-4777-8777-777777777771', '77777777-7777-4777-8777-777777777772'];

const TEAMS_RELATIONS = ['tasks', 'tasks.members', 'tasks.teams', 'tasks.tags', 'members', 'members.employee.user'];

type Measured = {
	team: any;
	statements: string[];
	error?: string;
};

async function measure(): Promise<Measured> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'typeorm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-public-team-relations-${process.pid}-${Date.now()}.sqlite3`);
	const measured: Measured = { team: undefined, statements: [] };
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { DataSource } = require('typeorm');
			const { OrganizationTeam } = require('../../organization-team/organization-team.entity');
			const { PublicTeamService } = require('./public-team.service');

			const statements: string[] = [];
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				logging: true,
				logger: {
					logQuery: (query: string) => statements.push(query),
					logQueryError: () => undefined,
					logQuerySlow: () => undefined,
					logSchemaBuild: () => undefined,
					logMigration: () => undefined,
					log: () => undefined
				}
			});
			await dataSource.initialize();

			for (const table of ['employee']) {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
					await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
				}
			}

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
						? 0
						: /date|time/.test(type)
							? '2026-01-01 00:00:00'
							: 'x';
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
						.map(() => '?')
						.join(', ')})`,
					keys.map((key) => values[key])
				);
			};

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization', brandColor: '#123456' });
			await insert('organization_team', { ...scope, id: TEAM, name: 'Public Team', public: 1, profile_link: 'public-team' });
			await insert('organization_team', { ...scope, id: OTHER_TEAM, name: 'Other', public: 1, profile_link: 'other' });
			for (const [index, name] of ['Ada', 'Grace', 'Linus'].entries()) {
				await insert('user', { id: USERS[index], tenantId: TENANT, firstName: name, lastName: 'L', imageUrl: `${name}.png` });
				await insert('employee', { ...scope, id: EMPLOYEES[index], userId: USERS[index], isActive: 1 });
			}
			// Ada and Grace are members of the public team; Linus is not.
			for (const [index, employeeId] of [EMPLOYEES[0], EMPLOYEES[1]].entries()) {
				await insert('organization_team_employee', {
					...scope,
					id: `88888888-8888-4888-8888-88888888888${index}`,
					organizationTeamId: TEAM,
					employeeId,
					isActive: 1
				});
			}
			for (const [index, id] of TAGS.entries()) {
				await insert('tag', { ...scope, id, name: `Tag ${index + 1}` });
			}
			// T1 (Ada, Grace; tag 1; the public team + the other team), T2 (Linus; tag 1 and 2; the public team),
			// T3 (nobody; no tag; the other team only — not this team's task).
			for (const [index, id] of TASKS.entries()) {
				await insert('task', { ...scope, id, title: `Task ${index + 1}`, public: 1 });
			}
			for (const [taskId, employeeId] of [
				[TASKS[0], EMPLOYEES[0]],
				[TASKS[0], EMPLOYEES[1]],
				[TASKS[1], EMPLOYEES[2]]
			]) {
				await insert('task_employee', { taskId, employeeId });
			}
			for (const [taskId, tagId] of [
				[TASKS[0], TAGS[0]],
				[TASKS[1], TAGS[0]],
				[TASKS[1], TAGS[1]]
			]) {
				await insert('tag_task', { taskId, tagId });
			}
			for (const [taskId, organizationTeamId] of [
				[TASKS[0], TEAM],
				[TASKS[0], OTHER_TEAM],
				[TASKS[1], TEAM],
				[TASKS[2], OTHER_TEAM]
			]) {
				await insert('task_team', { taskId, organizationTeamId });
			}

			const service = new PublicTeamService(
				dataSource.getRepository(OrganizationTeam),
				{ getTasks: async () => [] } as any,
				{ getTimerWorkedStatus: async () => [] } as any
			);

			statements.length = 0;
			try {
				const team = await service.findOneByProfileLink(
					{ profile_link: 'public-team', id: TEAM },
					{ relations: TEAMS_RELATIONS } as any
				);
				measured.team = JSON.parse(JSON.stringify(team));
			} catch (error) {
				measured.error = (error as Error).message;
			}
			measured.statements = [...statements];
		});
	} finally {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(file, { force: true });
		process.env.DB_ORM = previous.DB_ORM;
		process.env.DB_TYPE = previous.DB_TYPE;
	}
	return measured;
}

describe('PublicTeamService.findOneByProfileLink on SQLite — relations loaded per query', () => {
	let measured: Measured;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	it('answers the team with its tasks, each with its assignees, tags and teams', () => {
		expect(measured.error).toBeUndefined();
		const tasks = [...measured.team.tasks].sort((a: any, b: any) => a.id.localeCompare(b.id));
		expect(
			tasks.map((task: any) => [
				task.id,
				(task.members ?? []).map((member: any) => member.id).sort(),
				(task.tags ?? []).map((tag: any) => tag.name).sort(),
				(task.teams ?? []).map((team: any) => team.id).sort()
			])
		).toEqual([
			// A task's teams are narrowed to the link's own team (`publicTaskTeams`): the other team never shows.
			[TASKS[0], [EMPLOYEES[0], EMPLOYEES[1]], ['Tag 1'], [TEAM]],
			[TASKS[1], [EMPLOYEES[2]], ['Tag 1', 'Tag 2'], [TEAM]]
		]);
	});

	it('answers the members with their employee and user, selecting the public fields only', () => {
		const members = [...measured.team.members].sort((a: any, b: any) => a.employeeId.localeCompare(b.employeeId));
		expect(members.map((member: any) => [member.employeeId, member.employee?.user?.firstName])).toEqual([
			[EMPLOYEES[0], 'Ada'],
			[EMPLOYEES[1], 'Grace']
		]);
		// The partial select of the public read: an employee row carries no HR or tracking column.
		for (const member of members) {
			expect(Object.keys(member.employee).sort()).toEqual(expect.not.arrayContaining(['billRateValue', 'payPeriod']));
			expect(member.employee.user.lastName).toBe('L');
		}
	});

	it('joins neither the tasks nor the members onto the team row: the team read is one row, the relations their own queries', () => {
		// The team's own read names the profile link; the relation queries (one per relation) do not.
		const teamReads = measured.statements.filter((sql) => /"profile_link" = \?/.test(sql));
		expect(teamReads).toHaveLength(1);
		expect(teamReads[0]).not.toMatch(/JOIN "(task_team|task_employee|organization_team_employee|tag_task|task)"/);
		expect(measured.statements.length).toBeGreaterThan(1);
	});
});
