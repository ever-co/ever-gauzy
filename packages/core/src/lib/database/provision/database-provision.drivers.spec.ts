import { ensureDatabaseExists } from './ensure-database-exists';
import { createMySqlAdminConnection } from './mysql-database.provisioner';
import { createPgAdminClient } from './postgres-database.provisioner';

/**
 * The real drivers behind the provisioners, against a port nothing listens on: proves that `pg` and `mysql2` load,
 * accept the options the provisioners give them, and that an unreachable server ends as a warning (startup goes
 * on) rather than as a crash or a hang. No database server is needed.
 */
describe('database provisioning with the real drivers', () => {
	jest.setTimeout(30_000);

	const closedPort = 1;
	const enabled = { DB_CREATE_IF_NOT_EXISTS: 'true' } as NodeJS.ProcessEnv;

	it('builds a pg client from the provisioner options', async () => {
		const client = await createPgAdminClient({
			host: '127.0.0.1',
			port: closedPort,
			user: 'gauzy',
			password: 'not-logged',
			database: 'postgres',
			connectionTimeoutMillis: 2000,
			application_name: 'gauzy-db-provision'
		});

		expect(typeof client.connect).toBe('function');
		expect(typeof client.query).toBe('function');
		await expect(client.connect()).rejects.toThrow();
	});

	it('reports an unreachable mysql2 server as a failed connection', async () => {
		await expect(
			createMySqlAdminConnection({ host: '127.0.0.1', port: closedPort, user: 'gauzy', connectTimeout: 2000 })
		).rejects.toThrow();
	});

	it.each(['postgres', 'mysql'])('lets startup continue when the %s server cannot be reached', async (type) => {
		const logger = { log: jest.fn(), warn: jest.fn() };

		await expect(
			ensureDatabaseExists(
				{
					type,
					host: '127.0.0.1',
					port: closedPort,
					username: 'gauzy',
					password: 'not-logged',
					database: 'gauzy',
					extra: { connectionTimeoutMillis: 2000 }
				},
				{ env: enabled, logger }
			)
		).resolves.toBe('unverified');

		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(logger.warn.mock.calls[0][0]).toContain('127.0.0.1:1');
		expect(logger.warn.mock.calls[0][0]).not.toContain('not-logged');
	});
});
