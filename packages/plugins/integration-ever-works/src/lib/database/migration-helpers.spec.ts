import { addForeignKeyIfMissing, createIndexIfMissing } from './migration-helpers';

/**
 * The API and the worker run the plugin's migrations together. On MySQL nothing serialises them, so a
 * second process can find an index (or a foreign key) missing, and see it created by the first one
 * before its own CREATE runs. That is not an error.
 */
describe('migration helpers under concurrent migrations (MySQL)', () => {
	/** A MySQL query runner: probes answer from `exists` in turn; DDL throws `ddlError` when given. */
	function runner(exists: boolean[], ddlError?: Error) {
		const queries: string[] = [];
		const probes = [...exists];
		return {
			queries,
			queryRunner: {
				connection: { options: { type: 'mysql' } },
				query: async (sql: string) => {
					queries.push(sql);
					if (/^SELECT 1/.test(sql)) return probes.shift() ? [{ 1: 1 }] : [];
					if (ddlError) throw ddlError;
					return [];
				}
			} as never
		};
	}
	const duplicate = Object.assign(new Error("Duplicate key name 'IDX_x'"), { code: 'ER_DUP_KEYNAME' });

	it('an index created by another process between the probe and the CREATE is accepted', async () => {
		const { queryRunner, queries } = runner([false, true], duplicate);
		await expect(createIndexIfMissing(queryRunner, 't', { name: 'IDX_x', columns: ['a'] })).resolves.toBeUndefined();
		expect(queries.filter((q) => q.startsWith('CREATE'))).toHaveLength(1);
	});

	it('any other failure of the CREATE still fails the migration', async () => {
		const { queryRunner } = runner([false, false], new Error('disk full'));
		await expect(createIndexIfMissing(queryRunner, 't', { name: 'IDX_x', columns: ['a'] })).rejects.toThrow('disk full');
	});

	it('the same holds for a foreign key', async () => {
		const ok = runner([false, true], Object.assign(new Error('Duplicate foreign key'), { code: 'ER_FK_DUP_NAME' }));
		await expect(
			addForeignKeyIfMissing(ok.queryRunner, 't', { name: 'FK_x', column: 'tenantId', references: 'tenant', onDelete: 'CASCADE' })
		).resolves.toBeUndefined();
		const failing = runner([false, false], new Error('no such table'));
		await expect(
			addForeignKeyIfMissing(failing.queryRunner, 't', { name: 'FK_x', column: 'tenantId', references: 'tenant', onDelete: 'CASCADE' })
		).rejects.toThrow('no such table');
	});

	it('an existing index issues no DDL at all', async () => {
		const { queryRunner, queries } = runner([true]);
		await createIndexIfMissing(queryRunner, 't', { name: 'IDX_x', columns: ['a'] });
		expect(queries.some((q) => q.startsWith('CREATE'))).toBe(false);
	});
});
