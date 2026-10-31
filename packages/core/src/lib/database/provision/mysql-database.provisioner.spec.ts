import { DatabaseProvisionError, DatabaseProvisionTarget } from './database-provisioner';
import {
	MySqlAdminConnection,
	MySqlAdminConnectionConfig,
	MySqlDatabaseProvisioner
} from './mysql-database.provisioner';

/** A `mysql2` error: a message, a symbolic code and an errno. */
function mysqlError(code: string, errno: number, message: string): Error & { code: string; errno: number } {
	return Object.assign(new Error(message), { code, errno });
}

/**
 * A fake `mysql2/promise` connection: `INFORMATION_SCHEMA.SCHEMATA` holds `existing`, and `CREATE DATABASE` either
 * succeeds or fails with `createError`. Every statement and the connection options are recorded.
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
	/** Fails only the lookups after the first one. */
	recheckError?: Error;
	createError?: Error;
	/** The database appears (another replica created it) as the CREATE fails. */
	createdMeanwhile?: boolean;
} = {}) {
	const statements: Array<{ sql: string; values?: unknown[] }> = [];
	const configs: MySqlAdminConnectionConfig[] = [];
	const connection: MySqlAdminConnection & { end: jest.Mock } = {
		query: jest.fn(async (sql: string, values?: unknown[]) => {
			statements.push({ sql, values });
			if (sql.startsWith('SELECT')) {
				if (lookupError) throw lookupError;
				if (recheckError && statements.filter((s) => s.sql.startsWith('SELECT')).length > 1) throw recheckError;
				const rows = existing.includes(values?.[0] as string) ? [{ SCHEMA_NAME: values?.[0] }] : [];
				return [rows, []] as [unknown, unknown];
			}
			if (createError) {
				if (createdMeanwhile) existing.push('gauzy');
				throw createError;
			}
			return [{ affectedRows: 1 }, undefined] as [unknown, unknown];
		}),
		end: jest.fn(async () => undefined)
	};
	const provisioner = new MySqlDatabaseProvisioner({
		connect: async (config) => {
			configs.push(config);
			if (connectError) throw connectError;
			return connection;
		}
	});
	return { provisioner, connection, statements, configs };
}

const target: DatabaseProvisionTarget = {
	type: 'mysql',
	database: 'gauzy',
	host: 'db.local',
	port: 3307,
	user: 'gauzy_app',
	password: 'not-logged',
	ssl: undefined
};

describe('MySqlDatabaseProvisioner', () => {
	it('connects to the server, without selecting a database, with the API connection settings', async () => {
		const { provisioner, configs } = fakeServer({ existing: ['gauzy'] });

		await provisioner.ensureDatabase(target);

		expect(configs).toEqual([
			{
				host: 'db.local',
				port: 3307,
				user: 'gauzy_app',
				password: 'not-logged',
				ssl: undefined,
				connectTimeout: 10_000
			}
		]);
	});

	it('listens for connection errors, so a connection dropping while idle cannot crash startup', async () => {
		const { provisioner, connection } = fakeServer({ existing: ['gauzy'] });
		const listeners: Array<(error: Error) => void> = [];
		connection.on = (event: 'error', listener: (error: Error) => void) => listeners.push(listener);

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');

		expect(listeners).toHaveLength(1);
		expect(() => listeners[0](new Error('Connection lost: The server closed the connection.'))).not.toThrow();
	});

	it('creates nothing when the database exists, looking it up with a bound parameter', async () => {
		const { provisioner, statements, connection } = fakeServer({ existing: ['gauzy'] });

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');

		expect(statements).toEqual([
			{ sql: 'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', values: ['gauzy'] }
		]);
		expect(connection.end).toHaveBeenCalledTimes(1);
	});

	it('creates a missing database once, quoted as an identifier, in utf8mb4', async () => {
		const { provisioner, statements, connection } = fakeServer();

		await expect(provisioner.ensureDatabase({ ...target, database: 'gauzy`dev' })).resolves.toBe('created');

		expect(statements.map((statement) => statement.sql)).toEqual([
			'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
			'CREATE DATABASE IF NOT EXISTS `gauzy``dev` CHARACTER SET utf8mb4'
		]);
		expect(connection.end).toHaveBeenCalledTimes(1);
	});

	it.each([
		['ER_DBACCESS_DENIED_ERROR', 1044],
		['ER_SPECIFIC_ACCESS_DENIED_ERROR', 1227]
	])('explains the missing CREATE privilege (%s)', async (code, errno) => {
		const { provisioner, connection } = fakeServer({
			createError: mysqlError(code, errno, "Access denied for user 'gauzy_app'@'%' to database 'gauzy'")
		});

		const error = await provisioner.ensureDatabase(target).catch((caught) => caught);

		expect(error).toBeInstanceOf(DatabaseProvisionError);
		expect(error.stage).toBe('create');
		expect(error.message).toContain('needs the CREATE privilege');
		expect(error.message).toContain('CREATE DATABASE `gauzy` CHARACTER SET utf8mb4;');
		expect(error.message).toContain('Access denied');
		expect(error.message).not.toContain('not-logged');
		expect(connection.end).toHaveBeenCalledTimes(1);
	});

	it('answers "exists" when the user may not create it but another process has created the database', async () => {
		const { provisioner, statements } = fakeServer({
			createError: mysqlError('ER_DBACCESS_DENIED_ERROR', 1044, "Access denied for user 'gauzy_app'@'%'"),
			createdMeanwhile: true
		});

		await expect(provisioner.ensureDatabase(target)).resolves.toBe('exists');

		expect(statements.map((statement) => statement.sql)).toEqual([
			'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
			'CREATE DATABASE IF NOT EXISTS `gauzy` CHARACTER SET utf8mb4',
			'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?'
		]);
	});

	it('reports the CREATE error when the second lookup fails as well', async () => {
		const { provisioner } = fakeServer({
			createError: mysqlError('ER_DBACCESS_DENIED_ERROR', 1044, "Access denied for user 'gauzy_app'@'%'"),
			recheckError: new Error('Connection lost: The server closed the connection.')
		});

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({
			stage: 'create',
			message: expect.stringContaining('needs the CREATE privilege')
		});
	});

	it('reports any other creation failure with the server message', async () => {
		const { provisioner } = fakeServer({
			createError: mysqlError('ER_WRONG_DB_NAME', 1102, "Incorrect database name 'gauzy '")
		});

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({
			stage: 'create',
			message: expect.stringContaining('Incorrect database name')
		});
	});

	it('reports refused credentials as a connect failure, without the password', async () => {
		const { provisioner, statements } = fakeServer({
			connectError: mysqlError('ER_ACCESS_DENIED_ERROR', 1045, "Access denied for user 'gauzy_app'@'10.0.0.2'")
		});

		const error = await provisioner.ensureDatabase(target).catch((caught) => caught);

		expect(error).toMatchObject({ stage: 'connect' });
		expect(error.message).toContain('db.local:3307');
		expect(error.message).not.toContain('not-logged');
		expect(statements).toEqual([]);
	});

	it('reports a failed lookup as a check failure and closes the connection', async () => {
		const { provisioner, connection } = fakeServer({ lookupError: new Error('information_schema unavailable') });

		await expect(provisioner.ensureDatabase(target)).rejects.toMatchObject({ stage: 'check' });
		expect(connection.end).toHaveBeenCalledTimes(1);
	});

	it('refuses a name over 64 characters before connecting', async () => {
		const { provisioner, configs } = fakeServer();

		await expect(provisioner.ensureDatabase({ ...target, database: 'x'.repeat(65) })).rejects.toMatchObject({
			stage: 'config'
		});
		expect(configs).toEqual([]);
	});
});
