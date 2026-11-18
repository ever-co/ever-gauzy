import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DataSource } from 'typeorm';
import type { EmbedClientService } from './embed-client.service';

/**
 * The client of an embed credential and its spent time, read through TypeORM on one SQLite database with the tables
 * TypeORM creates for every entity: a contact counts only in its own tenant and organization, and only while it is not
 * deleted; its report counts only the entries of its own projects there, not deleted and not breaks. A timer start keeps
 * to it only on one of those projects, with a task of that project or none. A token lists its client's projects, or
 * its member's without a client, neither archived nor deleted.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '7b000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7b000000-0000-4000-8000-00000000000b';
const ORGANIZATION = '7b000000-0000-4000-8000-0000000000f1';
const OTHER_ORGANIZATION = '7b000000-0000-4000-8000-0000000000f2';
const NORTHWIND = '7b000000-0000-4000-8000-0000000000d1';
const CONTOSO = '7b000000-0000-4000-8000-0000000000d2';
const FABRIKAM = '7b000000-0000-4000-8000-0000000000d3';
const WITHDRAWN = '7b000000-0000-4000-8000-0000000000d4';
const LITWARE = '7b000000-0000-4000-8000-0000000000d5';

const WEBSITE = '7b000000-0000-4000-8000-0000000000a1';
const MOBILE_APP = '7b000000-0000-4000-8000-0000000000a2';
const ARCHIVE = '7b000000-0000-4000-8000-0000000000a3';
const INTRANET = '7b000000-0000-4000-8000-0000000000a4';
const REMOVED = '7b000000-0000-4000-8000-0000000000a5';
const ABROAD = '7b000000-0000-4000-8000-0000000000a6';

const HOMEPAGE = '7b000000-0000-4000-8000-0000000000b1';
const SIGN_UP = '7b000000-0000-4000-8000-0000000000b2';
const DROPPED = '7b000000-0000-4000-8000-0000000000b3';
const MISFILED = '7b000000-0000-4000-8000-0000000000b4';
const UNKNOWN = '7b000000-0000-4000-8000-0000000000ff';

const BRAND = '7b000000-0000-4000-8000-0000000000a7';
const RETIRED = '7b000000-0000-4000-8000-0000000000a8';
const LINA = '7b000000-0000-4000-8000-0000000000e1';
const MARCO = '7b000000-0000-4000-8000-0000000000e2';

/** Thursday 19 November 2026, 15:00 in Paris (UTC+1), the organization's zone. */
const NOW = new Date('2026-11-19T14:00:00.000Z');
const HOUR = 3600;

const SCOPE = { tenantId: TENANT, organizationId: ORGANIZATION };

/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
async function insert(dataSource: DataSource, table: string, row: Record<string, unknown>): Promise<void> {
	const columns = (await dataSource.query(`PRAGMA table_info("${table}")`)) as Array<{
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}>;
	const values: Record<string, unknown> = { ...row };
	for (const column of columns) {
		const isFilled = column.name in values;
		const isOptional = !column.notnull || column.dflt_value !== null || column.pk === 1;
		if (isFilled || isOptional) {
			continue;
		}
		values[column.name] = placeholderOf(column.type);
	}
	const keys = Object.keys(values);
	const names = keys.map((key) => `"${key}"`).join(', ');
	const marks = keys.map(() => '?').join(', ');
	await dataSource.query(
		`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
		keys.map((key) => values[key])
	);
}

function placeholderOf(type: string): unknown {
	const lower = type.toLowerCase();
	if (/int|bool|numeric|decimal|real|float/.test(lower)) {
		return 0;
	}
	if (/date|time/.test(lower)) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}

/** The tenants, organizations and contacts every case reads. */
async function seedClients(dataSource: DataSource): Promise<void> {
	await dataSource.query('PRAGMA foreign_keys = OFF');
	await insert(dataSource, 'tenant', { id: TENANT, name: 'Agency' });
	await insert(dataSource, 'tenant', { id: OTHER_TENANT, name: 'Other agency' });
	await insert(dataSource, 'organization', {
		id: ORGANIZATION,
		tenantId: TENANT,
		name: 'Agency',
		currency: 'EUR',
		timeZone: 'Europe/Paris'
	});
	await insert(dataSource, 'organization', {
		id: OTHER_ORGANIZATION,
		tenantId: TENANT,
		name: 'Agency abroad',
		currency: 'EUR'
	});
	await insert(dataSource, 'organization_contact', { ...SCOPE, id: NORTHWIND, name: 'Northwind' });
	await insert(dataSource, 'organization_contact', {
		tenantId: TENANT,
		organizationId: OTHER_ORGANIZATION,
		id: CONTOSO,
		name: 'Contoso'
	});
	await insert(dataSource, 'organization_contact', {
		tenantId: OTHER_TENANT,
		organizationId: ORGANIZATION,
		id: FABRIKAM,
		name: 'Fabrikam'
	});
	await insert(dataSource, 'organization_contact', {
		...SCOPE,
		id: WITHDRAWN,
		name: 'Withdrawn',
		deletedAt: '2026-01-05 10:00:00'
	});
	await insert(dataSource, 'organization_contact', { ...SCOPE, id: LITWARE, name: 'Litware' });
}

/** A project of a client, in the agency's organization unless it says otherwise. */
async function insertProject(dataSource: DataSource, row: Record<string, unknown>): Promise<void> {
	await insert(dataSource, 'organization_project', { ...SCOPE, ...row });
}

let entryCount = 0;

/** A time entry, in the agency's organization unless it says otherwise; times in UTC, as TypeORM stores them. */
async function insertEntry(dataSource: DataSource, row: Record<string, unknown>): Promise<void> {
	entryCount += 1;
	const id = `7b000000-0000-4000-8000-${String(entryCount).padStart(12, '0')}`;
	await insert(dataSource, 'time_log', { ...SCOPE, id, employeeId: 'an-employee', ...row });
}

/** Northwind's projects and the entries around this week, with every entry its report must leave out. */
async function seedTime(dataSource: DataSource): Promise<void> {
	await insertProject(dataSource, { id: WEBSITE, name: 'Website', organizationContactId: NORTHWIND });
	await insertProject(dataSource, { id: MOBILE_APP, name: 'Mobile app', organizationContactId: NORTHWIND });
	await insertProject(dataSource, { id: ARCHIVE, name: 'Archive', organizationContactId: NORTHWIND });
	await insertProject(dataSource, { id: INTRANET, name: 'Intranet', organizationContactId: LITWARE });
	await insertProject(dataSource, {
		id: REMOVED,
		name: 'Removed',
		organizationContactId: NORTHWIND,
		deletedAt: '2026-11-17 08:00:00.000'
	});
	await insertProject(dataSource, {
		id: ABROAD,
		name: 'Abroad',
		organizationContactId: NORTHWIND,
		organizationId: OTHER_ORGANIZATION
	});

	// Counted. 23:00 Wednesday to 01:00 Thursday, Paris time: an hour today, two this week.
	await insertEntry(dataSource, {
		projectId: WEBSITE,
		startedAt: '2026-11-18 22:00:00.000',
		stoppedAt: '2026-11-19 00:00:00.000'
	});
	// 23:00 Sunday to 01:00 Monday: an hour this week.
	await insertEntry(dataSource, {
		projectId: MOBILE_APP,
		startedAt: '2026-11-15 22:00:00.000',
		stoppedAt: '2026-11-16 00:00:00.000'
	});
	// A timer running since 14:00, Paris time, its stored end its start: an hour up to the request.
	await insertEntry(dataSource, {
		projectId: WEBSITE,
		startedAt: '2026-11-19 13:00:00.000',
		stoppedAt: '2026-11-19 13:00:00.000',
		isRunning: 1
	});
	await insertEntry(dataSource, {
		projectId: MOBILE_APP,
		startedAt: '2026-11-17 09:00:00.000',
		stoppedAt: '2026-11-17 10:30:00.000'
	});
	// A desktop upload, stored as running: up to its stored end.
	await insertEntry(dataSource, {
		projectId: WEBSITE,
		startedAt: '2026-11-18 08:00:00.000',
		stoppedAt: '2026-11-18 09:00:00.000',
		isRunning: 1,
		source: 'DESKTOP'
	});
	// Before the week: the project has no time this week.
	await insertEntry(dataSource, {
		projectId: ARCHIVE,
		startedAt: '2026-11-10 10:00:00.000',
		stoppedAt: '2026-11-10 12:00:00.000'
	});
	// A desktop upload of last week, stored as running: not even read.
	await insertEntry(dataSource, {
		projectId: WEBSITE,
		startedAt: '2026-11-09 08:00:00.000',
		stoppedAt: '2026-11-09 09:00:00.000',
		isRunning: 1,
		source: 'DESKTOP'
	});

	// Left out: another client's project, a deleted entry, a break, a deleted project, another organization's project,
	// an entry filed under another organization or another tenant, and one after the week.
	const today = { startedAt: '2026-11-19 08:00:00.000', stoppedAt: '2026-11-19 09:00:00.000' };
	await insertEntry(dataSource, { ...today, projectId: INTRANET });
	await insertEntry(dataSource, { ...today, projectId: WEBSITE, deletedAt: '2026-11-19 09:30:00.000' });
	await insertEntry(dataSource, { ...today, projectId: WEBSITE, logType: 'BREAK' });
	await insertEntry(dataSource, { ...today, projectId: REMOVED });
	await insertEntry(dataSource, { ...today, projectId: ABROAD, organizationId: OTHER_ORGANIZATION });
	await insertEntry(dataSource, { ...today, projectId: WEBSITE, organizationId: OTHER_ORGANIZATION });
	await insertEntry(dataSource, { ...today, projectId: WEBSITE, tenantId: OTHER_TENANT });
	await insertEntry(dataSource, {
		projectId: WEBSITE,
		startedAt: '2026-11-23 10:00:00.000',
		stoppedAt: '2026-11-23 11:00:00.000'
	});
}

/** Tasks of the website and of another client's project, with a deleted one and one filed under another organization. */
async function seedTasks(dataSource: DataSource): Promise<void> {
	await insert(dataSource, 'task', { ...SCOPE, id: HOMEPAGE, title: 'Homepage', number: 1, projectId: WEBSITE });
	await insert(dataSource, 'task', { ...SCOPE, id: SIGN_UP, title: 'Sign-up', number: 1, projectId: INTRANET });
	await insert(dataSource, 'task', {
		...SCOPE,
		id: DROPPED,
		title: 'Dropped',
		number: 2,
		projectId: WEBSITE,
		deletedAt: '2026-11-17 08:00:00.000'
	});
	await insert(dataSource, 'task', {
		...SCOPE,
		id: MISFILED,
		title: 'Misfiled',
		number: 3,
		projectId: WEBSITE,
		organizationId: OTHER_ORGANIZATION
	});
}

let membershipCount = 0;

/** A member of a project, in the agency's organization unless it says otherwise. */
async function insertMembership(dataSource: DataSource, row: Record<string, unknown>): Promise<void> {
	membershipCount += 1;
	const id = `7b000000-0000-4000-8000-1000000000${String(membershipCount).padStart(2, '0')}`;
	await insert(dataSource, 'organization_project_employee', { ...SCOPE, id, ...row });
}

/**
 * A project of Northwind named in lower case and an archived one, and Lina's memberships: a project of each client, an
 * archived one, a deleted one, one of the other organization, and a membership that was deleted.
 */
async function seedProjectsToTrack(dataSource: DataSource): Promise<void> {
	await insertProject(dataSource, { id: BRAND, name: 'brand refresh', organizationContactId: NORTHWIND });
	await insertProject(dataSource, { id: RETIRED, name: 'Retired', organizationContactId: NORTHWIND, isArchived: 1 });

	await insertMembership(dataSource, { employeeId: LINA, organizationProjectId: WEBSITE });
	await insertMembership(dataSource, { employeeId: LINA, organizationProjectId: INTRANET, isManager: 1 });
	await insertMembership(dataSource, { employeeId: LINA, organizationProjectId: RETIRED });
	await insertMembership(dataSource, { employeeId: LINA, organizationProjectId: REMOVED });
	await insertMembership(dataSource, {
		employeeId: LINA,
		organizationProjectId: ABROAD,
		organizationId: OTHER_ORGANIZATION
	});
	await insertMembership(dataSource, {
		employeeId: LINA,
		organizationProjectId: MOBILE_APP,
		deletedAt: '2026-11-17 08:00:00.000'
	});
	await insertMembership(dataSource, { employeeId: MARCO, organizationProjectId: ARCHIVE });
}

describe('EmbedClientService on SQLite', () => {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	const file = path.join(os.tmpdir(), `gauzy-embed-client-${process.pid}-${Date.now()}.sqlite3`);
	let dataSource: DataSource;
	let service: EmbedClientService;

	beforeAll(async () => {
		process.env.DB_ORM = 'typeorm';
		process.env.DB_TYPE = 'better-sqlite3';
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities') as typeof import('../core/entities');
			const typeorm = require('typeorm') as typeof import('typeorm');
			const clients = require('./embed-client.service') as typeof import('./embed-client.service');
			dataSource = new typeorm.DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();
			await seedClients(dataSource);
			await seedTime(dataSource);
			await seedTasks(dataSource);
			await seedProjectsToTrack(dataSource);
			service = new clients.EmbedClientService(dataSource);
		});
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(file, { force: true });
		process.env.DB_ORM = previous.DB_ORM;
		process.env.DB_TYPE = previous.DB_TYPE;
	});

	it('finds a contact of the organization, by its id and name only', async () => {
		expect(await service.findClient(NORTHWIND, SCOPE)).toEqual({ id: NORTHWIND, name: 'Northwind' });
	});

	it('finds no contact of another organization, of another tenant, deleted or unknown', async () => {
		expect(await service.findClient(CONTOSO, SCOPE)).toBeNull();
		expect(await service.findClient(FABRIKAM, SCOPE)).toBeNull();
		expect(await service.findClient(WITHDRAWN, SCOPE)).toBeNull();
		expect(await service.findClient('7b000000-0000-4000-8000-0000000000d9', SCOPE)).toBeNull();
	});

	it('finds nothing without a contact id, a tenant or an organization, instead of any contact', async () => {
		expect(await service.findClient(undefined, SCOPE)).toBeNull();
		expect(await service.findClient(NORTHWIND, { tenantId: undefined, organizationId: ORGANIZATION })).toBeNull();
		expect(await service.findClient(NORTHWIND, { tenantId: TENANT, organizationId: undefined })).toBeNull();
	});

	it("answers the client's time today, this week and by project, and nothing else", async () => {
		const report = await service.reportOf(NORTHWIND, SCOPE, NOW);

		expect(report).toStrictEqual({
			client: { id: NORTHWIND, name: 'Northwind' },
			timeZone: 'Europe/Paris',
			today: { date: '2026-11-19', seconds: 2 * HOUR },
			week: { start: '2026-11-16', end: '2026-11-22', seconds: 6.5 * HOUR },
			projects: [
				{ id: WEBSITE, name: 'Website', seconds: 4 * HOUR },
				{ id: MOBILE_APP, name: 'Mobile app', seconds: 2.5 * HOUR }
			]
		});
	});

	it('reads a desktop upload stored as running only when its stored end reaches into the week', async () => {
		// This week in Paris: Monday 16 November 00:00 up to Monday 23 November 00:00.
		const from = new Date('2026-11-15T23:00:00.000Z');
		const until = new Date('2026-11-22T23:00:00.000Z');
		const entries: Array<{ startedAt: Date; source: string }> = await (service as any).entriesOf(
			[{ id: WEBSITE, name: 'Website' }],
			SCOPE,
			{ from: { toDate: () => from }, until: { toDate: () => until } }
		);

		const read = entries.map((entry) => `${entry.source} ${entry.startedAt.toISOString()}`).sort();
		// The web timer's run and its running timer; the desktop upload of this week, not the one of last week.
		expect(read).toEqual([
			'BROWSER 2026-11-18T22:00:00.000Z',
			'BROWSER 2026-11-19T13:00:00.000Z',
			'DESKTOP 2026-11-18T08:00:00.000Z'
		]);
	});

	it('counts in UTC for an organization without a zone, with zeros for a client without projects', async () => {
		const report = await service.reportOf(CONTOSO, { tenantId: TENANT, organizationId: OTHER_ORGANIZATION }, NOW);

		expect(report).toStrictEqual({
			client: { id: CONTOSO, name: 'Contoso' },
			timeZone: 'UTC',
			today: { date: '2026-11-19', seconds: 0 },
			week: { start: '2026-11-16', end: '2026-11-22', seconds: 0 },
			projects: []
		});
	});

	it('answers no report for a client deleted, of another organization or of another tenant', async () => {
		expect(await service.reportOf(WITHDRAWN, SCOPE, NOW)).toBeNull();
		expect(await service.reportOf(CONTOSO, SCOPE, NOW)).toBeNull();
		expect(await service.reportOf(FABRIKAM, SCOPE, NOW)).toBeNull();
	});

	it('lets a start on a project of the client through, with a task of that project or none', async () => {
		expect(await service.isStartForClient(NORTHWIND, SCOPE, { projectId: WEBSITE, taskId: null })).toBe(true);
		expect(await service.isStartForClient(NORTHWIND, SCOPE, { projectId: ARCHIVE, taskId: null })).toBe(true);
		expect(await service.isStartForClient(NORTHWIND, SCOPE, { projectId: WEBSITE, taskId: HOMEPAGE })).toBe(true);
	});

	it('refuses a project of another client, deleted, of another organization or unknown', async () => {
		for (const projectId of [INTRANET, REMOVED, ABROAD, UNKNOWN, 'not-a-project']) {
			expect(await service.isStartForClient(NORTHWIND, SCOPE, { projectId, taskId: null })).toBe(false);
		}
		const abroad = { tenantId: TENANT, organizationId: OTHER_ORGANIZATION };
		expect(await service.isStartForClient(NORTHWIND, abroad, { projectId: ABROAD, taskId: null })).toBe(true);
		expect(await service.isStartForClient(LITWARE, SCOPE, { projectId: INTRANET, taskId: null })).toBe(true);
	});

	it('refuses a task of another project, deleted, of another organization or unknown', async () => {
		for (const taskId of [SIGN_UP, DROPPED, MISFILED, UNKNOWN, 'not-a-task']) {
			expect(await service.isStartForClient(NORTHWIND, SCOPE, { projectId: WEBSITE, taskId })).toBe(false);
		}
		const homepageOnMobileApp = { projectId: MOBILE_APP, taskId: HOMEPAGE };
		expect(await service.isStartForClient(NORTHWIND, SCOPE, homepageOnMobileApp)).toBe(false);
	});

	it('refuses every start without a client, a tenant or an organization, instead of matching any project', async () => {
		const website = { projectId: WEBSITE, taskId: null };

		const withoutTenant = { tenantId: undefined, organizationId: ORGANIZATION };
		const withoutOrganization = { tenantId: TENANT, organizationId: undefined };

		expect(await service.isStartForClient(undefined, SCOPE, website)).toBe(false);
		expect(await service.isStartForClient(NORTHWIND, withoutTenant, website)).toBe(false);
		expect(await service.isStartForClient(NORTHWIND, withoutOrganization, website)).toBe(false);
		expect(await service.isStartForClient(NORTHWIND, SCOPE, { projectId: undefined, taskId: null })).toBe(false);
	});

	it("lists a client's projects by name, without the archived, deleted or other organization's ones", async () => {
		const projects = await service.trackableProjectsOf({ ...SCOPE, employeeId: LINA, clientId: NORTHWIND });

		expect(projects).toStrictEqual([
			{ id: ARCHIVE, name: 'Archive' },
			{ id: BRAND, name: 'brand refresh' },
			{ id: MOBILE_APP, name: 'Mobile app' },
			{ id: WEBSITE, name: 'Website' }
		]);
	});

	it("lists a member's projects by name, as a member or a manager, for a token without a client", async () => {
		const projects = await service.trackableProjectsOf({ ...SCOPE, employeeId: LINA, clientId: null });

		expect(projects).toStrictEqual([
			{ id: INTRANET, name: 'Intranet' },
			{ id: WEBSITE, name: 'Website' }
		]);
		const abroad = { tenantId: TENANT, organizationId: OTHER_ORGANIZATION, employeeId: LINA, clientId: null };
		expect(await service.trackableProjectsOf(abroad)).toStrictEqual([{ id: ABROAD, name: 'Abroad' }]);
		const marco = await service.trackableProjectsOf({ ...SCOPE, employeeId: MARCO, clientId: null });
		expect(marco).toStrictEqual([{ id: ARCHIVE, name: 'Archive' }]);
	});

	it('lists nothing for a client, a member, a tenant or an organization it cannot name', async () => {
		const unnamed = [
			{ ...SCOPE, employeeId: LINA, clientId: 'not-a-client' },
			{ ...SCOPE, employeeId: '', clientId: null },
			{ ...SCOPE, employeeId: UNKNOWN, clientId: null },
			{ tenantId: undefined, organizationId: ORGANIZATION, employeeId: LINA, clientId: NORTHWIND },
			{ tenantId: TENANT, organizationId: undefined, employeeId: LINA, clientId: null }
		];
		for (const token of unnamed) {
			expect(await service.trackableProjectsOf(token)).toEqual([]);
		}
	});
});
