jest.mock('../core/context', () => ({ RequestContext: { currentRequest: () => null } }));
jest.mock('../core/file-storage', () => ({ FileStorage: class {} }));

import { deleteUnusedRows, isKeyOfTenant, onlyFilesOfTenant } from './account-deletion-files';

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
