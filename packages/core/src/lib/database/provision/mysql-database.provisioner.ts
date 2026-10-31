import { assertValidDatabaseName, MYSQL_MAX_DATABASE_NAME_LENGTH, quoteMySqlIdentifier } from './database-identifier';
import {
	DatabaseProvisioner,
	DatabaseProvisionError,
	DatabaseProvisionOutcome,
	DatabaseProvisionTarget,
	DEFAULT_PROVISION_CONNECT_TIMEOUT_MS,
	describeDriverError,
	describeServer,
	DriverError
} from './database-provisioner';

/** The part of a `mysql2/promise` connection the provisioner uses. */
export interface MySqlAdminConnection {
	/** Resolves to `[rows, fields]`, as `mysql2/promise` does. */
	query(sql: string, values?: unknown[]): Promise<[unknown, unknown?]>;
	end(): Promise<unknown>;
}

/** The `mysql2` connection options the provisioner sets: no `database`, the connection is to the server. */
export interface MySqlAdminConnectionConfig {
	host?: string;
	port?: number;
	user?: string;
	password?: unknown;
	ssl?: unknown;
	connectTimeout: number;
}

/** Opens the connection the provisioner works with; replaced in tests. */
export type MySqlAdminConnectionFactory = (config: MySqlAdminConnectionConfig) => Promise<MySqlAdminConnection>;

/**
 * A real `mysql2` connection. `mysql2` is loaded only here, when a MySQL database is actually provisioned, so
 * nothing else pays for it.
 */
export const createMySqlAdminConnection: MySqlAdminConnectionFactory = async (config) => {
	const mysql = await import('mysql2/promise');
	return (await mysql.createConnection(
		config as Parameters<typeof mysql.createConnection>[0]
	)) as unknown as MySqlAdminConnection;
};

const MYSQL_DEFAULT_PORT = 3306;

/** The access-denied errors (`ER_DBACCESS_DENIED_ERROR`, `ER_ACCESS_DENIED_ERROR`, `ER_SPECIFIC_ACCESS_DENIED_ERROR`). */
const MYSQL_ACCESS_DENIED = new Set([
	'ER_DBACCESS_DENIED_ERROR',
	'ER_ACCESS_DENIED_ERROR',
	'ER_SPECIFIC_ACCESS_DENIED_ERROR'
]);
const MYSQL_ACCESS_DENIED_ERRNOS = new Set([1044, 1045, 1227]);

export interface MySqlDatabaseProvisionerOptions {
	/** Defaults to {@link createMySqlAdminConnection}. */
	connect?: MySqlAdminConnectionFactory;
}

/**
 * Creates the configured MySQL database when it is missing.
 *
 * Connects to the server (no database selected) with the API's own host, credentials and TLS, looks the database
 * up in `INFORMATION_SCHEMA.SCHEMATA` with a bound parameter, and only when it is absent runs one
 * `CREATE DATABASE IF NOT EXISTS` with the name quoted as an identifier and `utf8mb4` as its character set, the
 * character set the API's connections use (MariaDB still defaults new databases to `latin1`).
 *
 * The lookup comes first on purpose: `CREATE DATABASE IF NOT EXISTS` still needs the CREATE privilege when the
 * database exists, so running it unconditionally would refuse a user that has every privilege it needs on an
 * existing database except that one.
 */
export class MySqlDatabaseProvisioner implements DatabaseProvisioner {
	private readonly connect: MySqlAdminConnectionFactory;

	constructor({ connect }: MySqlDatabaseProvisionerOptions = {}) {
		this.connect = connect ?? createMySqlAdminConnection;
	}

	async ensureDatabase(target: DatabaseProvisionTarget): Promise<DatabaseProvisionOutcome> {
		assertValidDatabaseName(target.database, { maxLength: MYSQL_MAX_DATABASE_NAME_LENGTH });

		const connection = await this.open(target);
		try {
			if (await this.exists(connection, target)) {
				return 'exists';
			}
			return await this.create(connection, target);
		} finally {
			// Closing must never hide the outcome (or the error) above.
			await connection.end().catch(() => undefined);
		}
	}

	private async open(target: DatabaseProvisionTarget): Promise<MySqlAdminConnection> {
		try {
			return await this.connect({
				host: target.host,
				port: target.port,
				user: target.user,
				password: target.password,
				ssl: target.ssl,
				connectTimeout: target.connectTimeoutMs || DEFAULT_PROVISION_CONNECT_TIMEOUT_MS
			});
		} catch (error) {
			throw new DatabaseProvisionError(
				`could not connect to MySQL at ${describeServer(target, MYSQL_DEFAULT_PORT)} as "${target.user}": ` +
					describeDriverError(error),
				'connect'
			);
		}
	}

	private async exists(connection: MySqlAdminConnection, target: DatabaseProvisionTarget): Promise<boolean> {
		try {
			const [rows] = await connection.query(
				'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
				[target.database]
			);
			return Array.isArray(rows) && rows.length > 0;
		} catch (error) {
			throw new DatabaseProvisionError(
				`could not look up database "${target.database}" in INFORMATION_SCHEMA.SCHEMATA: ${describeDriverError(error)}`,
				'check'
			);
		}
	}

	private async create(
		connection: MySqlAdminConnection,
		target: DatabaseProvisionTarget
	): Promise<DatabaseProvisionOutcome> {
		const database = quoteMySqlIdentifier(target.database);
		try {
			// IF NOT EXISTS: another replica (or a person) may have created it since the lookup.
			await connection.query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4`);
			return 'created';
		} catch (error) {
			const server = describeServer(target, MYSQL_DEFAULT_PORT);
			const { code, errno } = (error ?? {}) as DriverError;
			if (MYSQL_ACCESS_DENIED.has(code ?? '') || MYSQL_ACCESS_DENIED_ERRNOS.has(errno ?? 0)) {
				throw new DatabaseProvisionError(
					`database ${database} does not exist on ${server}, and user "${target.user}" may not create it: ` +
						`it needs the CREATE privilege. Grant it (e.g. GRANT ALL PRIVILEGES ON ${database}.* TO ` +
						`'${target.user}'@'<host>';), or create the database yourself (CREATE DATABASE ${database} ` +
						`CHARACTER SET utf8mb4;), or unset DB_CREATE_IF_NOT_EXISTS. MySQL said: ${describeDriverError(error)}`,
					'create'
				);
			}
			throw new DatabaseProvisionError(
				`database ${database} does not exist on ${server} and could not be created: ${describeDriverError(error)}`,
				'create'
			);
		}
	}
}
