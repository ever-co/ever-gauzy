jest.mock('../core/context', () => ({ RequestContext: { currentRequest: () => null } }));
jest.mock('../core/file-storage', () => ({ FileStorage: class {} }));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
	collectStoredFiles,
	deleteRowsAddressedTo,
	deleteUnusedRows,
	isKeyOfTenant,
	onlyFilesOfTenant
} from './account-deletion-files';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('isKeyOfTenant: only keys under the owning tenant are deleted', () => {
	it.each([
		`screenshots/2026/10/27/${TENANT}/33333333-3333-4333-8333-333333333333/shot.png`,
		`camshots/2026/10/27/${TENANT}/emp/cam.jpg`,
		`uploads/image_assets/${TENANT}/avatar.png`,
		`documents/${TENANT}/org/doc.pdf`,
		`inbox/${TENANT}/attachments/row/0-abc`,
		`uploads\\image_assets\\${TENANT}\\avatar.png`
	])('keeps %s', (key) => {
		expect(isKeyOfTenant(key, TENANT)).toBe(true);
	});

	it.each([
		// Another tenant's file, written into this tenant's image_asset by a client (POST /image-assets takes any url).
		`screenshots/2026/10/27/${OTHER}/emp/shot.png`,
		`documents/${OTHER}/org/doc.pdf`,
		// The tenant id inside a segment is not a directory of the tenant.
		`uploads/image_assets/x${TENANT}/a.png`,
		`uploads/image_assets/${TENANT}.png`,
		// Seeded or shared files outside any tenant directory.
		'ever-icons/open.svg',
		'',
		// Path traversal: the local provider normalizes the path to another tenant's file.
		'uploads/image_assets//..//avatar.png',
		`uploads/image_assets/${TENANT}/../../x/${OTHER}/f.png`,
		`uploads/image_assets/./${TENANT}/a.png`,
		// The tenant id where that kind of key does not put it.
		`documents/org/${TENANT}/doc.pdf`,
		`screenshots/${TENANT}/emp/shot.png`,
		`unknown/${TENANT}/file`
	])('leaves %p in storage', (key) => {
		expect(isKeyOfTenant(key, TENANT)).toBe(false);
	});

	it('keeps nothing without a tenant', () => {
		expect(isKeyOfTenant(`uploads/image_assets/${TENANT}/a.png`, null)).toBe(false);
	});

	it('filters a list down to the tenant’s own keys', () => {
		const own = { table: 'image_asset', key: `uploads/image_assets/${TENANT}/a.png` };
		const forged = { table: 'image_asset', key: `screenshots/2026/10/27/${OTHER}/emp/shot.png` };
		expect(onlyFilesOfTenant([own, forged], TENANT)).toEqual([own]);
	});
});

describe('deleteUnusedRows with a referencing table the database lacks', () => {
	it('skips that table and still deletes the unused row (it used to throw on the skipped result)', async () => {
		const referencing = (tablePath: string) => ({
			tablePath,
			tableType: 'regular',
			foreignKeys: [{ columnNames: ['contactId'], referencedTablePath: 'contact' }],
			columns: [{ databaseName: 'contactId', isNullable: true }]
		});
		const query = jest.fn(async (sql: string) => {
			if (sql.includes('information_schema')) {
				return [
					{ t: 'employee', c: 'contactId' },
					{ t: 'contact', c: 'id' }
				]; // no plugin_table
			}
			return [];
		});
		const manager = {
			query,
			connection: {
				entityMetadatas: [referencing('employee'), referencing('plugin_table')],
				driver: { options: { type: 'postgres' }, escape: (name: string) => `"${name}"` }
			}
		} as any;

		await expect(deleteUnusedRows(manager, 'contact', ['c1'])).resolves.toBe(1);
		expect(query).toHaveBeenCalledWith('DELETE FROM "contact" WHERE "id" = $1', ['c1']);
		expect(query.mock.calls.some(([sql]) => String(sql).includes('plugin_table'))).toBe(false);
	});
});

describe('collectStoredFiles for a factory reset', () => {
	it('takes every screenshot of the organizations (the reset deletes them itself), other captures only with a time slot', async () => {
		const capture = (tablePath: string, keys: string[]) => ({
			tablePath,
			tableType: 'regular',
			foreignKeys: [],
			columns: ['tenantId', 'organizationId', 'timeSlotId', 'storageProvider', ...keys].map((databaseName) => ({
				databaseName
			}))
		});
		const metadata = [capture('screenshot', ['file', 'thumb']), capture('camshots', ['fileKey', 'thumbKey'])];
		const query = jest.fn(async (sql: string) =>
			sql.includes('information_schema')
				? metadata.flatMap((m) => m.columns.map((c) => ({ t: m.tablePath, c: c.databaseName })))
				: []
		);
		const manager = {
			query,
			connection: {
				entityMetadatas: metadata,
				driver: { options: { type: 'postgres' }, escape: (name: string) => `"${name}"` }
			}
		} as any;

		await collectStoredFiles(manager, { kind: 'reset', tenantId: 't1', organizationIds: ['o1'] });

		const selects = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.startsWith('SELECT "'));
		expect(selects.find((sql) => sql.includes('FROM "screenshot"'))).not.toContain('IS NOT NULL');
		expect(selects.find((sql) => sql.includes('FROM "camshots"'))).toContain('"timeSlotId" IS NOT NULL');
	});
});

describe('deleteRowsAddressedTo: the workspace a person leaves keeps no row addressed to them (SQLite)', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-addressed-rows-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		for (const table of ['invite', 'email_sent']) {
			await dataSource.query(
				`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY, "tenantId" varchar, "email" varchar)`
			);
			await dataSource.query(
				`INSERT INTO "${table}" ("id", "tenantId", "email") VALUES
					('${table}-mine', '${TENANT}', 'Leaver@Example.test '),
					('${table}-coworker', '${TENANT}', 'stayer@example.test'),
					('${table}-other-workspace', '${OTHER}', 'leaver@example.test')`
			);
		}
	}, 30_000); // The first SQLite connection loads the native driver, slow on a busy machine.

	afterEach(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(dbPath, { force: true });
	});

	const ids = async (table: string) =>
		((await dataSource.query(`SELECT "id" FROM "${table}" ORDER BY "id"`)) as Array<{ id: string }>).map(
			({ id }) => id
		);

	it('deletes the invitations and sent-email history of the address, in that workspace only, whatever the case', async () => {
		await deleteRowsAddressedTo(dataSource.manager, TENANT, ' LEAVER@example.test');

		for (const table of ['invite', 'email_sent']) {
			expect(await ids(table)).toEqual([`${table}-coworker`, `${table}-other-workspace`]);
		}
	});

	it('deletes nothing without a workspace or an address', async () => {
		await deleteRowsAddressedTo(dataSource.manager, '', 'leaver@example.test');
		await deleteRowsAddressedTo(dataSource.manager, TENANT, '  ');

		expect(await ids('invite')).toHaveLength(3);
		expect(await ids('email_sent')).toHaveLength(3);
	});

	it('skips a table the schema lacks', async () => {
		await dataSource.query('DROP TABLE "email_sent"');

		await expect(deleteRowsAddressedTo(dataSource.manager, TENANT, 'leaver@example.test')).resolves.toBeUndefined();
		expect(await ids('invite')).toEqual(['invite-coworker', 'invite-other-workspace']);
	});
});
