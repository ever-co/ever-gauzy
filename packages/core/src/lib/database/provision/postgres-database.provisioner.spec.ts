import { DatabaseProvisionError, DatabaseProvisionTarget } from './database-provisioner';
import {
	PostgresAdminClient,
	PostgresAdminClientConfig,
	PostgresDatabaseProvisioner
} from './postgres-database.provisioner';

/** A `pg` error: a message and a SQLSTATE code. */
function pgError(code: string, message: string): Error & { code: string } {
	return Object.assign(new Error(message), { code });
}

/**
 * A fake `pg` client: `pg_database` holds `existing`, and `CREATE DATABASE` either succeeds or fails with
 * `createError`. With `createdMeanwhile`, the database appears (another replica created it) as the CREATE fails.
 * `lookupError` fails every lookup, `recheckError` only the ones after the first. Every statement and the client
 * options are recorded.
 */
function fakeServer({
	existing = [] as string[],
	connectError,
	lookupError,
	recheckError,
	createError,
	createdMeanwhile = false
}: {
	existing?: string[];
	connectError?: Error;
	lookupError?: Error;
	recheckError?: Error;
	createError?: Error;
	createdMeanwhile?: boolean;
} = {}) {
	const statements: Array<{ text: string; values?: unknown[] }> = [];
	const configs: PostgresAdminClientConfig[] = [];
	const client: PostgresAdminClient & { end: jest.Mock } = {
		connect: jest.fn(async () => {
			if (connectError) throw connectError;
		}),
		query: jest.fn(async (text: string, values?: unknown[]) => {
			statements.push({ text, values });
			if (text.startsWith('SELECT')) {
				if (lookupError) throw lookupError;
				if (recheckError && statements.filter((s) => s.text.startsWith('SELECT')).length > 1)
					throw recheckError;
				return { rows: existing.includes(values?.[0] as string) ? [{ '?column?': 1 }] : [] };
			}
			if (createError) {
				if (createdMeanwhile) existing.push('gauzy');
				throw createError;
			}
			return { rows: [] };
		}),
		end: jest.fn(async () => undefined)
	};
	const provisioner = new PostgresDatabaseProvisioner({
		createClient: (config) => {
			configs.push(config);
			return client;
		}
	});
	return { provisioner, client, statements, configs };
}

const target: DatabaseProvisionTarget = {
	type: 'postgres',
	database: 'gauzy',
	host: 'db.local',
	port: 5433,
	user: 'gauzy_app',
	password: 'not-logged',
	ssl: { rejectUnauthorized: true, ca: 'CA' },
	connectTimeoutMs: 2000
};

describe('PostgresDatabaseProvisioner', () => {
	it('connects to the maintenance database with the API connection settings', async () => {
		const { provisioner, configs } = fakeServer({ existing: ['gauzy'] });

		await provisioner.ensureDatabase(target);

		expect(configs).toEqual([
			{
				host: 'db.local',
				port: 5433,
				user: 'gauzy_app',
				password: 'not-logged',
				database: 'postgres',
				ssl: { rejectUnauthorized: true, ca: 'CA' },
				connectionTimeoutMillis: 2000,
				application_name: 'gauzy-db-provision'
			}
		]);
	});

	it('uses the configured maintenance database, and a 10 s connect timeout when none is configured', async () => {
		const configs: PostgresAdminClientConfig[] = [];
		const provisioner = new PostgresDatabaseProvisioner({
			maintenanceDatabase: ' template1 ',
			createClient: (config) => {
				configs.push(config);
				return {
					connect: async () => undefined,
					query: async () => ({ rows: [1] }),
					end: async () => undefined
				};
			}
		});

		await provisioner.ensureDatabase({ ...target, connectTimeoutMs: undefined });

		expect(configs[0].database).toBe('template1');
		expect(configs[0].connectionTimeoutMillis).toBe(10_000);
	});

	it("runs the session with the API's statement and lock timeouts and TCP keep-alive", async () => {
		const { provisioner, configs } = fakeServer({ existing: ['gauzy'] });

		await provisioner.ensureDatabase({
			...target,
			statementTimeoutMs: 30_000,
			lockTimeoutMs: 5_000,
			keepAlive: true,
			keepAliveInitialDelayMs: 10_000
		});

		expect(configs[0]).toEqual(
			expect.objectContaining({
				statement_timeout: 30_000,
				lock_timeout: 5_000,
				keepAlive: true,
				keepAliveInitialDelayMillis: 10_000
			})
		);
	});

	it('listens for connection errors before connecting, so a dropped connection cannot crash startup', async () => {
		const listeners: Array<(error: Error) => void> = [];
		const order: string[] = [];
		const provisioner = new PostgresDatabaseProvisioner({
			createClient: () => ({
				on: (event: 'error', listener: (error: Error) => void) => {
					order.push(`on:${event}`);
					listeners.push(listener);
				},
				connect: async () => {
					order.push('connect');
				},
				query: async () => ({ rows: [1] }),
				end: async () => undefined
			})
		});

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');

		expect(order).toEqual(['on:error', 'connect']);
		expect(() => listeners[0](new Error('Connection terminated unexpectedly'))).not.toThrow();
	});

	it('creates nothing when the database exists, looking it up with a bound parameter', async () => {
		const { provisioner, statements, client } = fakeServer({ existing: ['gauzy'] });

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');

		expect(statements).toEqual([{ text: 'SELECT 1 FROM pg_database WHERE datname = $1', values: ['gauzy'] }]);
		expect(client.end).toHaveBeenCalledTimes(1);
	});

	it('creates a missing database once, with its name quoted as an identifier', async () => {
		const { provisioner, statements, client } = fakeServer();

		await expect(provisioner.ensureDatabase({ ...target, database: 'Gauzy "Dev"' })).resolves.toBe('created');

		expect(statements.map((statement) => statement.text)).toEqual([
			'SELECT 1 FROM pg_database WHERE datname = $1',
			'CREATE DATABASE "Gauzy ""Dev"""'
		]);
		expect(statements[0].values).toEqual(['Gauzy "Dev"']);
		expect(client.end).toHaveBeenCalledTimes(1);
	});

	it('answers "exists" when another process created the database first', async () => {
		const { provisioner } = fakeServer({ createError: pgError('42P04', 'database "gauzy" already exists') });

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');
	});

	it.each([
		['23505', 'duplicate key value violates unique constraint "pg_database_datname_index"'],
		['42501', 'permission denied to create database']
	])(
		'answers "exists" when CREATE fails with %s but another process has created the database',
		async (code, message) => {
			const { provisioner, statements } = fakeServer({
				createError: pgError(code, message),
				createdMeanwhile: true
			});

			await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');

			expect(statements.map((statement) => statement.text)).toEqual([
				'SELECT 1 FROM pg_database WHERE datname = $1',
				'CREATE DATABASE "gauzy"',
				'SELECT 1 FROM pg_database WHERE datname = $1'
			]);
		}
	);

	it('reports the CREATE error when the second lookup fails as well', async () => {
		const { provisioner } = fakeServer({
			createError: pgError('42501', 'permission denied to create database'),
			recheckError: new Error('Connection terminated unexpectedly')
		});

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({
			stage: 'create',
			message: expect.stringContaining('needs the CREATEDB privilege')
		});
	});

	it('explains the missing CREATEDB privilege, and closes the connection', async () => {
		const { provisioner, client } = fakeServer({
			createError: pgError('42501', 'permission denied to create database')
		});

		const error = await provisioner.ensureDatabase(target).catch((caught) => caught);

		expect(error).toBeInstanceOf(DatabaseProvisionError);
		expect(error.stage).toBe('create');
		expect(error.message).toContain('needs the CREATEDB privilege');
		expect(error.message).toContain('ALTER ROLE "gauzy_app" CREATEDB;');
		expect(error.message).toContain('CREATE DATABASE "gauzy" OWNER "gauzy_app";');
		expect(error.message).toContain('permission denied to create database');
		expect(error.message).not.toContain('not-logged');
		expect(client.end).toHaveBeenCalledTimes(1);
	});

	it('reports any other creation failure with the server message', async () => {
		const { provisioner } = fakeServer({
			createError: pgError('55006', 'source database "template1" is being accessed by other users')
		});

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({
			stage: 'create',
			message: expect.stringContaining('is being accessed by other users')
		});
	});

	it('reports an unreachable server as a connect failure, without the password', async () => {
		const { provisioner, statements } = fakeServer({
			connectError: Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5433'), { code: 'ECONNREFUSED' })
		});

		const error = await provisioner.ensureDatabase(target).catch((caught) => caught);

		expect(error).toMatchObject({ stage: 'connect' });
		expect(error.message).toContain('db.local:5433');
		expect(error.message).toContain('ECONNREFUSED');
		expect(error.message).not.toContain('not-logged');
		expect(statements).toEqual([]);
	});

	it('suggests DB_CREATE_MAINTENANCE_DB when the maintenance database does not exist', async () => {
		const { provisioner } = fakeServer({ connectError: pgError('3D000', 'database "postgres" does not exist') });

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({
			stage: 'connect',
			message: expect.stringContaining('Set DB_CREATE_MAINTENANCE_DB')
		});
	});

	it('reports a failed lookup as a check failure and closes the connection', async () => {
		const { provisioner, client } = fakeServer({ lookupError: new Error('relation "pg_database" is hidden') });

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({ stage: 'check' });
		expect(client.end).toHaveBeenCalledTimes(1);
	});

	it('keeps the outcome when closing the connection fails', async () => {
		const { provisioner, client } = fakeServer({ existing: ['gauzy'] });
		client.end.mockRejectedValueOnce(new Error('already closed'));

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');
	});

	it('refuses an invalid name before connecting', async () => {
		const { provisioner, configs } = fakeServer();

		await expect(provisioner.ensureDatabase({ ...target, database: 'x'.repeat(64) })).rejects.toMatchObject({
			stage: 'config'
		});
		expect(configs).toEqual([]);
	});
});
