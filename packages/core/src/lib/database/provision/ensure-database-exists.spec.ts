import { DatabaseProvisioner, DatabaseProvisionError, DatabaseProvisionTarget } from './database-provisioner';
import {
	createDatabaseProvisioners,
	DatabaseConnectionOptionsLike,
	ensureDatabaseExists,
	isDatabaseCreationEnabled,
	toDatabaseProvisionTarget
} from './ensure-database-exists';
import { MySqlDatabaseProvisioner } from './mysql-database.provisioner';
import { PostgresDatabaseProvisioner } from './postgres-database.provisioner';

const postgresOptions: DatabaseConnectionOptionsLike = {
	type: 'postgres',
	host: 'db.local',
	port: 5432,
	username: 'gauzy_app',
	password: 'not-logged',
	database: 'gauzy',
	ssl: undefined,
	extra: { connectionTimeoutMillis: 2000 }
};

function provisionerReturning(result: Promise<'exists' | 'created'>) {
	const ensureDatabase = jest.fn<Promise<'exists' | 'created'>, [DatabaseProvisionTarget]>(() => result);
	const provisioner: DatabaseProvisioner = { ensureDatabase };
	return { provisioner, ensureDatabase };
}

function fakeLogger() {
	return { log: jest.fn(), warn: jest.fn() };
}

const enabled = { DB_CREATE_IF_NOT_EXISTS: 'true' } as NodeJS.ProcessEnv;

describe('isDatabaseCreationEnabled', () => {
	it.each([
		[undefined, false],
		['', false],
		['false', false],
		['0', false],
		['yes', false],
		['true', true],
		[' TRUE ', true],
		['1', true]
	])('DB_CREATE_IF_NOT_EXISTS=%p is %p', (value, expected) => {
		expect(isDatabaseCreationEnabled({ DB_CREATE_IF_NOT_EXISTS: value } as NodeJS.ProcessEnv)).toBe(expected);
	});
});

describe('toDatabaseProvisionTarget', () => {
	it('reads the connection settings the ORM is about to use', () => {
		expect(toDatabaseProvisionTarget(postgresOptions)).toEqual({
			type: 'postgres',
			database: 'gauzy',
			host: 'db.local',
			port: 5432,
			user: 'gauzy_app',
			password: 'not-logged',
			ssl: undefined,
			connectTimeoutMs: 2000
		});
	});

	it('reads the session limits and keep-alive @gauzy/config sets for PostgreSQL', () => {
		const target = toDatabaseProvisionTarget({
			...postgresOptions,
			extra: {
				connectionTimeoutMillis: 2000,
				statement_timeout: 30_000,
				lock_timeout: 5_000,
				keepAlive: true,
				keepAliveInitialDelayMillis: 10_000
			}
		});

		expect(target).toEqual(
			expect.objectContaining({
				statementTimeoutMs: 30_000,
				lockTimeoutMs: 5_000,
				keepAlive: true,
				keepAliveInitialDelayMs: 10_000
			})
		);
	});

	it('leaves out a limit that is unset, zero or not a number', () => {
		const target = toDatabaseProvisionTarget({
			...postgresOptions,
			extra: { statement_timeout: 0, lock_timeout: '5000', keepAlive: 'yes' }
		});

		expect(target.statementTimeoutMs).toBeUndefined();
		expect(target.lockTimeoutMs).toBeUndefined();
		expect(target.keepAlive).toBeUndefined();
		expect(target.keepAliveInitialDelayMs).toBeUndefined();
	});

	it('reads a connection configured by URL alone, as TypeORM does', () => {
		const target = toDatabaseProvisionTarget({
			type: 'postgres',
			url: 'postgres://gauzy%40app:p%40ss@db.example:6543/gauzy%20dev?sslmode=require'
		});

		expect(target).toEqual(
			expect.objectContaining({
				type: 'postgres',
				host: 'db.example',
				port: 6543,
				user: 'gauzy@app',
				password: 'p@ss',
				database: 'gauzy dev'
			})
		);
	});

	it('lets the URL win over the separate fields, keeps those it leaves out, and ignores one that does not parse', () => {
		expect(
			toDatabaseProvisionTarget({ ...postgresOptions, url: 'mysql://[::1]/other' }) // no user, password or port
		).toEqual(
			expect.objectContaining({
				host: '::1',
				port: 5432,
				user: 'gauzy_app',
				password: 'not-logged',
				database: 'other'
			})
		);
		expect(toDatabaseProvisionTarget({ ...postgresOptions, url: 'not a url' })).toEqual(
			toDatabaseProvisionTarget(postgresOptions)
		);
	});

	it('ignores a database that is not a name (an SQLite buffer)', () => {
		expect(toDatabaseProvisionTarget({ type: 'sqljs', database: new Uint8Array(1) }).database).toBe('');
	});
});

describe('createDatabaseProvisioners', () => {
	it('provides PostgreSQL and MySQL, and nothing for SQLite', () => {
		const provisioners = createDatabaseProvisioners({});

		expect(provisioners['postgres']).toBeInstanceOf(PostgresDatabaseProvisioner);
		expect(provisioners['mysql']).toBeInstanceOf(MySqlDatabaseProvisioner);
		expect(provisioners['better-sqlite3']).toBeUndefined();
		expect(provisioners['sqlite']).toBeUndefined();
	});
});

describe('ensureDatabaseExists', () => {
	it('does nothing at all while DB_CREATE_IF_NOT_EXISTS is off (the default)', async () => {
		const { provisioner, ensureDatabase } = provisionerReturning(Promise.resolve('created'));
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(postgresOptions, { env: {}, logger, provisioners: { postgres: provisioner } })
		).resolves.toBe('disabled');

		expect(ensureDatabase).not.toHaveBeenCalled();
		expect(logger.log).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('is a no-op for SQLite, whose driver creates the file itself', async () => {
		const { provisioner, ensureDatabase } = provisionerReturning(Promise.resolve('created'));
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(
				{ type: 'better-sqlite3', database: '/data/gauzy.sqlite3' },
				{ env: enabled, logger, provisioners: { postgres: provisioner } }
			)
		).resolves.toBe('not-applicable');

		expect(ensureDatabase).not.toHaveBeenCalled();
		expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('SQLite creates its database file'));
	});

	it('hands the provisioner of the configured DB_TYPE the target, and logs a created database', async () => {
		const { provisioner, ensureDatabase } = provisionerReturning(Promise.resolve('created'));
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(postgresOptions, { env: enabled, logger, provisioners: { postgres: provisioner } })
		).resolves.toBe('created');

		expect(ensureDatabase).toHaveBeenCalledWith(toDatabaseProvisionTarget(postgresOptions));
		expect(logger.log).toHaveBeenCalledWith('DB_CREATE_IF_NOT_EXISTS: created database "gauzy".');
	});

	it('logs an existing database', async () => {
		const { provisioner } = provisionerReturning(Promise.resolve('exists'));
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(postgresOptions, { env: enabled, logger, provisioners: { postgres: provisioner } })
		).resolves.toBe('exists');

		expect(logger.log).toHaveBeenCalledWith('DB_CREATE_IF_NOT_EXISTS: database "gauzy" exists.');
	});

	it.each(['connect', 'check'] as const)('warns and lets startup continue when the %s step fails', async (stage) => {
		const { provisioner } = provisionerReturning(
			Promise.reject(new DatabaseProvisionError('could not connect: ECONNREFUSED', stage))
		);
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(postgresOptions, { env: enabled, logger, provisioners: { postgres: provisioner } })
		).resolves.toBe('unverified');

		expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('could not connect: ECONNREFUSED'));
		expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Startup continues'));
		expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('not-logged'));
	});

	it('warns rather than stopping startup on an unexpected error', async () => {
		const { provisioner } = provisionerReturning(Promise.reject(new TypeError('boom')));
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(postgresOptions, { env: enabled, logger, provisioners: { postgres: provisioner } })
		).resolves.toBe('unverified');
	});

	it('goes on with startup when the server does not answer in time, and logs why', async () => {
		const { provisioner } = provisionerReturning(new Promise<never>(() => undefined));
		const logger = fakeLogger();

		await expect(
			ensureDatabaseExists(postgresOptions, {
				env: enabled,
				logger,
				provisioners: { postgres: provisioner },
				timeoutMs: 20
			})
		).resolves.toBe('unverified');

		expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('did not answer within'));
		expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Startup continues'));
		expect(logger.log).not.toHaveBeenCalled();
	});

	it('ignores whatever the provisioner does after the deadline', async () => {
		let fail: (error: Error) => void = () => undefined;
		const late = new Promise<'created'>((_, reject) => (fail = reject));
		const { provisioner } = provisionerReturning(late);
		const unhandled = jest.fn();
		process.on('unhandledRejection', unhandled);

		try {
			await expect(
				ensureDatabaseExists(postgresOptions, {
					env: enabled,
					logger: fakeLogger(),
					provisioners: { postgres: provisioner },
					timeoutMs: 5
				})
			).resolves.toBe('unverified');
			fail(new DatabaseProvisionError('could not be created', 'create'));
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			process.off('unhandledRejection', unhandled);
		}

		expect(unhandled).not.toHaveBeenCalled();
	});

	it('waits for the connect timeout plus a minute by default', async () => {
		jest.useFakeTimers();
		try {
			const { provisioner } = provisionerReturning(new Promise<never>(() => undefined));
			let result: string | undefined;
			void ensureDatabaseExists(postgresOptions, {
				env: enabled,
				logger: fakeLogger(),
				provisioners: { postgres: provisioner }
			}).then((value) => (result = value));

			await jest.advanceTimersByTimeAsync(2000 + 60_000 - 1);
			expect(result).toBeUndefined();

			await jest.advanceTimersByTimeAsync(1);
			expect(result).toBe('unverified');
		} finally {
			jest.useRealTimers();
		}
	});

	it.each(['create', 'config'] as const)(
		'stops startup with a clear message when the %s step fails',
		async (stage) => {
			const { provisioner } = provisionerReturning(
				Promise.reject(new DatabaseProvisionError('role "gauzy_app" needs the CREATEDB privilege', stage))
			);

			const error = await ensureDatabaseExists(postgresOptions, {
				env: enabled,
				logger: fakeLogger(),
				provisioners: { postgres: provisioner }
			}).catch((caught) => caught);

			expect(error).toBeInstanceOf(DatabaseProvisionError);
			expect(error.stage).toBe(stage);
			expect(error.message).toBe('DB_CREATE_IF_NOT_EXISTS: role "gauzy_app" needs the CREATEDB privilege');
		}
	);

	it('creates a missing PostgreSQL database end to end through the built-in provisioner', async () => {
		const statements: string[] = [];
		const postgres = new PostgresDatabaseProvisioner({
			createClient: () => ({
				connect: async () => undefined,
				query: async (text: string) => {
					statements.push(text);
					return { rows: [] };
				},
				end: async () => undefined
			})
		});

		await expect(
			ensureDatabaseExists(postgresOptions, { env: enabled, logger: fakeLogger(), provisioners: { postgres } })
		).resolves.toBe('created');

		expect(statements).toEqual(['SELECT 1 FROM pg_database WHERE datname = $1', 'CREATE DATABASE "gauzy"']);
	});
});
