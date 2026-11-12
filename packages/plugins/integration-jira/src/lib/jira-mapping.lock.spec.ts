import { ConflictException } from '@nestjs/common';
import { JiraMappingService } from './jira-mapping.service';

type WithMappingsLock = (scope: { tenantId: string; organizationId: string }, work: (manager: unknown) => Promise<unknown>) => Promise<unknown>;
const withMappingsLock = (JiraMappingService.prototype as unknown as { withMappingsLock: WithMappingsLock }).withMappingsLock;

/** The lock over a query runner double of the given dialect, recording what it runs, in order. */
function harness(dialect: string, acquired = 1) {
	const steps: string[] = [];
	const runner = {
		connection: { options: { type: dialect } },
		manager: { name: 'manager' },
		connect: jest.fn(async () => undefined),
		query: jest.fn(async (sql: string) => {
			steps.push(sql);
			return sql.startsWith('SELECT GET_LOCK') ? [{ acquired }] : [];
		}),
		startTransaction: jest.fn(async () => void steps.push('BEGIN')),
		commitTransaction: jest.fn(async () => void steps.push('COMMIT')),
		rollbackTransaction: jest.fn(async () => void steps.push('ROLLBACK')),
		release: jest.fn(async () => void steps.push('RELEASE CONNECTION'))
	};
	const self = { dataSource: { createQueryRunner: () => runner } };
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
	const run = (work: (manager: unknown) => Promise<unknown>) =>
		withMappingsLock.call(self, scope, async (manager: unknown) => {
			steps.push('WORK');
			return work(manager);
		});
	return { run, steps, runner };
}

describe('the lock of an organization’s mappings', () => {
	it('takes a transaction advisory lock on Postgres, released by the commit', async () => {
		const { run, steps } = harness('postgres');
		expect(await run(async () => 'done')).toBe('done');
		expect(steps).toEqual(['BEGIN', 'SELECT pg_advisory_xact_lock(hashtext($1))', 'WORK', 'COMMIT', 'RELEASE CONNECTION']);
	});

	it('holds a named lock on MySQL from before the transaction to after its commit (never a row lock)', async () => {
		const { run, steps, runner } = harness('mysql');
		await run(async () => 'done');
		expect(steps).toEqual(['SELECT GET_LOCK(?, ?) AS acquired', 'BEGIN', 'WORK', 'COMMIT', 'SELECT RELEASE_LOCK(?)', 'RELEASE CONNECTION']);
		const [[, [name]]] = runner.query.mock.calls as unknown as Array<[string, unknown[]]>;
		expect(String(name)).toMatch(/^ijm:[0-9a-f]{40}$/);
	});

	it('rolls back and still releases the named lock when the work fails; refuses (409) when it cannot be had', async () => {
		const failing = harness('mariadb');
		await expect(failing.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		expect(failing.steps).toEqual(['SELECT GET_LOCK(?, ?) AS acquired', 'BEGIN', 'WORK', 'ROLLBACK', 'SELECT RELEASE_LOCK(?)', 'RELEASE CONNECTION']);

		const busy = harness('mysql', 0);
		await expect(busy.run(async () => 'never')).rejects.toBeInstanceOf(ConflictException);
		expect(busy.steps).toEqual(['SELECT GET_LOCK(?, ?) AS acquired', 'RELEASE CONNECTION']);
	});

	it('takes no lock on SQLite (it serializes writers itself)', async () => {
		const { run, steps } = harness('better-sqlite3');
		expect(await run(async () => 'done')).toBe('done');
		expect(steps).toEqual(['BEGIN', 'WORK', 'COMMIT', 'RELEASE CONNECTION']);
	});
});
