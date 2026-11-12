import { ConflictException } from '@nestjs/common';
import { JiraMappingService } from './jira-mapping.service';

type WithMappingsLock = (scope: { tenantId: string; organizationId: string }, work: (manager: unknown) => Promise<unknown>) => Promise<unknown>;
const withMappingsLock = (JiraMappingService.prototype as unknown as { withMappingsLock: WithMappingsLock }).withMappingsLock;

/** The lock over a transaction double of the given dialect, recording the statements it runs. */
function harness(dialect: string, acquired = 1) {
	const queries: Array<[string, unknown[]]> = [];
	const manager = {
		connection: { options: { type: dialect } },
		query: jest.fn(async (sql: string, parameters: unknown[] = []) => {
			queries.push([sql, parameters]);
			return sql.startsWith('SELECT GET_LOCK') ? [{ acquired }] : [];
		})
	};
	const self = { dataSource: { transaction: async (work: (m: typeof manager) => Promise<unknown>) => work(manager) } };
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
	return { run: (work: (m: unknown) => Promise<unknown>) => withMappingsLock.call(self, scope, work), queries };
}

describe('the lock of an organization’s mappings', () => {
	it('takes a transaction-scoped advisory lock on Postgres', async () => {
		const { run, queries } = harness('postgres');
		expect(await run(async () => 'done')).toBe('done');
		expect(queries).toEqual([['SELECT pg_advisory_xact_lock(hashtext($1))', ['integration-jira:mappings:tenant-1:org-1']]]);
	});

	it('takes a named lock on MySQL (never a row lock another connection’s foreign-key check would wait on), and releases it', async () => {
		const { run, queries } = harness('mysql');
		await run(async () => 'done');
		expect(queries.map(([sql]) => sql)).toEqual(['SELECT GET_LOCK(?, ?) AS acquired', 'SELECT RELEASE_LOCK(?)']);
		const [[, [name]], [, [released]]] = queries;
		expect(String(name)).toMatch(/^ijm:[0-9a-f]{40}$/);
		expect(released).toBe(name);
	});

	it('releases the named lock when the work fails, and refuses (409) when it cannot be had', async () => {
		const failing = harness('mariadb');
		await expect(failing.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		expect(failing.queries.map(([sql]) => sql)).toContain('SELECT RELEASE_LOCK(?)');

		const busy = harness('mysql', 0);
		await expect(busy.run(async () => 'never')).rejects.toBeInstanceOf(ConflictException);
		expect(busy.queries.map(([sql]) => sql)).toEqual(['SELECT GET_LOCK(?, ?) AS acquired']);
	});

	it('takes nothing on SQLite (it serializes writers itself)', async () => {
		const { run, queries } = harness('better-sqlite3');
		expect(await run(async () => 'done')).toBe('done');
		expect(queries).toEqual([]);
	});
});
