/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import {
	teamNotificationDefaultsByEmployee,
	teamNotificationDefaultsOf,
	teamNotificationDefaultsTransformer,
	withTeamNotificationDefaults
} from './team-notification-defaults';

describe('teamNotificationDefaultsOf', () => {
	it('keeps the known keys with a valid value each, from an object or its JSON', () => {
		expect(
			teamNotificationDefaultsOf({
				email: 'digest',
				emailByType: { Mention: 'immediate', Comment: 'loud', '': 'off' },
				push: false,
				pushByType: { TaskUpdate: false, Mention: 'yes' },
				taskUpdate: false,
				timerReminderHours: 6,
				taskDueReminderHours: 0,
				dnd: { start: '22:00', end: '07:00' },
				digestHour: 9,
				anything: 'else'
			})
		).toEqual({
			email: 'digest',
			emailByType: { Mention: 'immediate' },
			push: false,
			pushByType: { TaskUpdate: false },
			taskUpdate: false,
			timerReminderHours: 6,
			taskDueReminderHours: null
		});
		expect(teamNotificationDefaultsOf(JSON.stringify({ taskDueReminderHours: 48 }))).toEqual({
			taskDueReminderHours: 48
		});
	});

	it('drops a threshold out of range, and is null when nothing valid is left', () => {
		expect(teamNotificationDefaultsOf({ timerReminderHours: 30, taskDueReminderHours: 500 })).toBeNull();
		expect(teamNotificationDefaultsOf({ email: 'loud' })).toBeNull();
		expect(teamNotificationDefaultsOf(null)).toBeNull();
		expect(teamNotificationDefaultsOf('not json')).toBeNull();
	});
});

describe('teamNotificationDefaultsTransformer', () => {
	it("stores the defaults as JSON in the text column of SQLite, the specs' database, and reads them back as kept", () => {
		const stored = teamNotificationDefaultsTransformer.to({ taskDueReminderHours: 48 });
		expect(stored).toBe('{"taskDueReminderHours":48}');
		expect(teamNotificationDefaultsTransformer.from(stored)).toEqual({ taskDueReminderHours: 48 });
		expect(teamNotificationDefaultsTransformer.from({ email: 'digest', bogus: 1 })).toEqual({ email: 'digest' });
		expect(teamNotificationDefaultsTransformer.to(null)).toBeNull();
		expect(teamNotificationDefaultsTransformer.from(null)).toBeNull();
	});
});

describe('withTeamNotificationDefaults', () => {
	const defaults = {
		email: 'digest' as const,
		emailByType: { Mention: 'immediate' as const, Comment: 'off' as const },
		taskDueReminderHours: 48
	};

	it('fills each key the member left unset, and keeps every one they set, kind by kind', () => {
		expect(
			withTeamNotificationDefaults({ emailByType: { Comment: 'digest' }, timerReminderHours: 4 }, defaults)
		).toEqual({
			email: 'digest',
			emailByType: { Mention: 'immediate', Comment: 'digest' },
			timerReminderHours: 4,
			taskDueReminderHours: 48
		});
	});

	it("keeps a member's mode for every kind over the team's per-kind modes, and their push over the team's", () => {
		// Email off for every kind is the member's choice for each kind they did not set one by one
		expect(withTeamNotificationDefaults({ email: 'off', emailByType: { Comment: 'digest' } }, defaults)).toEqual({
			email: 'off',
			emailByType: { Comment: 'digest' },
			taskDueReminderHours: 48
		});
		const pushOff = withTeamNotificationDefaults({ push: false }, { push: true, pushByType: { Mention: true } });
		expect(pushOff).toEqual({ push: false });
		const teamDefaults = { pushByType: { Mention: true } };
		expect(withTeamNotificationDefaults({ pushByType: { Comment: false } }, teamDefaults)).toEqual({
			pushByType: { Mention: true, Comment: false }
		});
	});

	it("reads the `email: true` the platform creates a setting with as unset, so the team's mode applies", () => {
		expect(withTeamNotificationDefaults({ email: true, inApp: true }, defaults)).toEqual({
			email: 'digest',
			inApp: true,
			emailByType: { Mention: 'immediate', Comment: 'off' },
			taskDueReminderHours: 48
		});
		// A member who turned email off with the boolean keeps it off
		expect(withTeamNotificationDefaults({ email: false }, defaults).email).toBe(false);
		expect(withTeamNotificationDefaults({ email: false }, defaults).emailByType).toBeUndefined();
	});

	it('keeps a choice of none: a member who turned a reminder off keeps it off', () => {
		expect(withTeamNotificationDefaults({ taskDueReminderHours: null }, defaults).taskDueReminderHours).toBeNull();
	});

	it("is the member's own preferences without defaults, and the team's for a member with none", () => {
		expect(withTeamNotificationDefaults({ email: 'off' }, null)).toEqual({ email: 'off' });
		expect(withTeamNotificationDefaults(undefined, defaults)).toEqual(defaults);
		expect(withTeamNotificationDefaults(JSON.stringify({ push: false }), { push: true })).toEqual({ push: false });
	});
});

describe('teamNotificationDefaultsByEmployee on SQLite', () => {
	const TENANT = randomUUID();
	const OTHER_TENANT = randomUUID();
	const ORGANIZATION = randomUUID();
	let dataSource: DataSource;

	beforeEach(async () => {
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "lastTeamId" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "notificationDefaults" text, "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationTeamId" varchar, "employeeId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
	});

	afterEach(async () => {
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	async function team(defaults: unknown, options: { tenantId?: string; isArchived?: boolean } = {}): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "organization_team" ("id", "tenantId", "organizationId", "notificationDefaults", "isArchived") VALUES (?, ?, ?, ?, ?)`,
			[
				id,
				options.tenantId ?? TENANT,
				ORGANIZATION,
				defaults === null ? null : JSON.stringify(defaults),
				options.isArchived ? 1 : 0
			]
		);
		return id;
	}

	async function employee(
		teams: string[],
		options: { lastTeamId?: string; tenantId?: string; inactive?: string[]; archived?: string[] } = {}
	): Promise<string> {
		const id = randomUUID();
		const userId = randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		await dataSource.query(`INSERT INTO "user" ("id", "lastTeamId") VALUES (?, ?)`, [
			userId,
			options.lastTeamId ?? null
		]);
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId") VALUES (?, ?, ?, ?)`,
			[id, tenantId, ORGANIZATION, userId]
		);
		for (const teamId of teams) {
			await dataSource.query(
				`INSERT INTO "organization_team_employee" ("id", "tenantId", "organizationTeamId", "employeeId", "isActive", "isArchived") VALUES (?, ?, ?, ?, ?, ?)`,
				[
					randomUUID(),
					tenantId,
					teamId,
					id,
					options.inactive?.includes(teamId) ? 0 : 1,
					options.archived?.includes(teamId) ? 1 : 0
				]
			);
		}
		return id;
	}

	it('reads the defaults of the team the member last worked in, else of their only team', async () => {
		const design = await team({ taskDueReminderHours: 48 });
		const support = await team({ email: 'digest' });
		const inDesign = await employee([design, support], { lastTeamId: design });
		const onlySupport = await employee([support]);

		const found = await teamNotificationDefaultsByEmployee(dataSource, [
			{ employeeId: inDesign, tenantId: TENANT },
			{ employeeId: onlySupport, tenantId: TENANT }
		]);

		expect(found.get(`${TENANT}:${inDesign}`)).toEqual({ taskDueReminderHours: 48 });
		expect(found.get(`${TENANT}:${onlySupport}`)).toEqual({ email: 'digest' });
	});

	it('reads none for a member of several teams who last worked in none of them, or whose team has none', async () => {
		const design = await team({ taskDueReminderHours: 48 });
		const support = await team({ email: 'digest' });
		const plain = await team(null);
		const undecided = await employee([design, support]);
		const inPlain = await employee([plain]);

		const found = await teamNotificationDefaultsByEmployee(dataSource, [
			{ employeeId: undecided, tenantId: TENANT },
			{ employeeId: inPlain, tenantId: TENANT }
		]);

		expect(found.size).toBe(0);
	});

	it('leaves out an archived team, a membership that ended, and a team of another tenant', async () => {
		const archived = await team({ email: 'off' }, { isArchived: true });
		const left = await team({ email: 'off' });
		const elsewhere = await team({ email: 'off' }, { tenantId: OTHER_TENANT });
		const ada = await employee([archived, left], { lastTeamId: archived, inactive: [left] });
		const grace = await employee([elsewhere]);

		const found = await teamNotificationDefaultsByEmployee(dataSource, [
			{ employeeId: ada, tenantId: TENANT },
			{ employeeId: grace, tenantId: TENANT }
		]);

		expect(found.size).toBe(0);
	});

	it('leaves out an archived membership, and a membership removed since, so their team no longer applies', async () => {
		const design = await team({ taskDueReminderHours: 48 });
		const support = await team({ email: 'digest' });
		const ada = await employee([design, support], { archived: [design] });
		const grace = await employee([design]);
		await dataSource.query(
			`UPDATE "organization_team_employee" SET "deletedAt" = CURRENT_TIMESTAMP WHERE "employeeId" = ?`,
			[grace]
		);

		const found = await teamNotificationDefaultsByEmployee(dataSource, [
			{ employeeId: ada, tenantId: TENANT },
			{ employeeId: grace, tenantId: TENANT }
		]);

		// Ada's one live team is support: its defaults apply, not the archived membership's
		expect(found.get(`${TENANT}:${ada}`)).toEqual({ email: 'digest' });
		expect(found.has(`${TENANT}:${grace}`)).toBe(false);
	});

	it('reads none when the defaults cannot be read, so nothing waits on them', async () => {
		await dataSource.query(`DROP TABLE "organization_team"`);

		const found = await teamNotificationDefaultsByEmployee(dataSource, [
			{ employeeId: randomUUID(), tenantId: TENANT }
		]);

		expect(found.size).toBe(0);
		expect(Logger.prototype.warn).toHaveBeenCalled();
	});
});
