import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DataSource } from 'typeorm';
import type { EmbedClientService } from './embed-client.service';

/**
 * The client of an embed credential, read through TypeORM on one SQLite database with the tables TypeORM creates for
 * every entity: a contact counts only in its own tenant and organization, and only while it is not deleted.
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
	await insert(dataSource, 'organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Agency', currency: 'EUR' });
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
});
