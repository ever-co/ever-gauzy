import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DataSource } from 'typeorm';
import type { EmbedClientService } from './embed-client.service';

/**
 * The client of an embed credential and its spent time, read through TypeORM on one SQLite database with the tables
 * TypeORM creates for every entity: a contact counts only in its own tenant and organization, and only while it is not
 * deleted; its report counts only the entries of its own projects there, not deleted and not breaks.
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
});
