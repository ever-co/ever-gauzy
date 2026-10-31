import {
	assertValidDatabaseName,
	POSTGRES_MAX_DATABASE_NAME_BYTES,
	quotePostgresIdentifier
} from './database-identifier';
import {
	DatabaseProvisioner,
	DatabaseProvisionError,
	DatabaseProvisionOutcome,
	DatabaseProvisionTarget,
	DEFAULT_PROVISION_CONNECT_TIMEOUT_MS,
	describeDriverError,
	describeServer,
	DriverError,
	whenAborted
} from './database-provisioner';

/** The part of a `pg` `Client` the provisioner uses. */
export interface PostgresAdminClient {
	connect(): Promise<unknown>;
	query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
	end(): Promise<unknown>;
	/** `pg` emits `error` when the connection drops; see {@link PostgresDatabaseProvisioner}. */
	on?(event: 'error', listener: (error: Error) => void): unknown;
}

/** The `pg` client options the provisioner sets. */
export interface PostgresAdminClientConfig {
	host?: string;
	port?: number;
	user?: string;
	password?: unknown;
	database: string;
	ssl?: unknown;
	connectionTimeoutMillis: number;
	application_name: string;
	/** The configured URL pointed at the maintenance database; `pg` lets its fields win over the separate ones. */
	connectionString?: string;
	statement_timeout?: number;
	lock_timeout?: number;
	keepAlive?: boolean;
	keepAliveInitialDelayMillis?: number;
}

/** Builds the client the provisioner connects with; replaced in tests. */
export type PostgresAdminClientFactory = (
	config: PostgresAdminClientConfig
) => PostgresAdminClient | Promise<PostgresAdminClient>;

/**
 * A real `pg` client. `pg` is loaded only here, when a PostgreSQL database is actually provisioned, so nothing
 * else pays for it.
 */
export const createPgAdminClient: PostgresAdminClientFactory = async (config) => {
	const { Client } = await import('pg');
	return new Client(config as ConstructorParameters<typeof Client>[0]) as unknown as PostgresAdminClient;
};

/**
 * The database the provisioner connects to in order to create another one. PostgreSQL has no "server-only"
 * connection: every session is bound to a database, and `postgres` is the one every installation creates for this
 * purpose (`createdb` itself uses it). Override with `DB_CREATE_MAINTENANCE_DB` (e.g. `template1`) where the role may
 * not connect to `postgres`.
 */
export const DEFAULT_POSTGRES_MAINTENANCE_DATABASE = 'postgres';

/** The connection URL pointed at another database, everything else (TLS settings such as `sslmode`) kept. */
export function connectionUrlForDatabase(url: string, database: string): string | undefined {
	try {
		const parsed = new URL(url);
		parsed.pathname = `/${encodeURIComponent(database)}`;
		return parsed.toString();
	} catch {
		return undefined;
	}
}

const POSTGRES_DEFAULT_PORT = 5432;

/** SQLSTATEs the provisioner tells apart (https://www.postgresql.org/docs/current/errcodes-appendix.html). */
const PG_DUPLICATE_DATABASE = '42P04';
const PG_INSUFFICIENT_PRIVILEGE = '42501';
const PG_INVALID_CATALOG_NAME = '3D000';

export interface PostgresDatabaseProvisionerOptions {
	/** See {@link DEFAULT_POSTGRES_MAINTENANCE_DATABASE}. Blank means the default. */
	maintenanceDatabase?: string;
	/** Defaults to {@link createPgAdminClient}. */
	createClient?: PostgresAdminClientFactory;
}

/**
 * Creates the configured PostgreSQL database when it is missing.
 *
 * Connects to the maintenance database with the API's own host, credentials and TLS, looks the database up in
 * `pg_database` (readable by every role) with a bound parameter, and only when it is absent runs one
 * `CREATE DATABASE "<name>"`, the name quoted as an identifier. The new database takes the server's defaults
 * (owner: the connecting role; encoding and locale: `template1`'s), as `createdb` would give it.
 *
 * The session gets the API's own `DB_STATEMENT_TIMEOUT` / `DB_LOCK_TIMEOUT` and TCP keep-alive settings, so the
 * server enforces the operator's limits here too (`ensureDatabaseExists` bounds the whole step as well).
 */
export class PostgresDatabaseProvisioner implements DatabaseProvisioner {
	private readonly maintenanceDatabase: string;
	private readonly createClient: PostgresAdminClientFactory;

	constructor({ maintenanceDatabase, createClient }: PostgresDatabaseProvisionerOptions = {}) {
		this.maintenanceDatabase = maintenanceDatabase?.trim() || DEFAULT_POSTGRES_MAINTENANCE_DATABASE;
		this.createClient = createClient ?? createPgAdminClient;
	}

	async ensureDatabase(target: DatabaseProvisionTarget, signal?: AbortSignal): Promise<DatabaseProvisionOutcome> {
		assertValidDatabaseName(target.database, { maxBytes: POSTGRES_MAX_DATABASE_NAME_BYTES });

		const client = await this.connect(target);
		// Ends the session once. Closing must never hide the outcome (or the error) below. When the caller stops
		// waiting it runs at once, and `pg` then drops the socket of a query that hangs instead of waiting for it.
		let closing: Promise<unknown> | undefined;
		const close = () => (closing ??= client.end().catch(() => undefined));
		const stopListening = whenAborted(signal, () => void close());
		try {
			if (await this.exists(client, target)) {
				return 'exists';
			}
			return await this.create(client, target);
		} finally {
			stopListening();
			await close();
		}
	}

	private async connect(target: DatabaseProvisionTarget): Promise<PostgresAdminClient> {
		try {
			const client = await this.createClient({
				host: target.host,
				port: target.port,
				user: target.user,
				password: target.password,
				database: this.maintenanceDatabase,
				ssl: target.ssl,
				connectionString: target.url
					? connectionUrlForDatabase(target.url, this.maintenanceDatabase)
					: undefined,
				connectionTimeoutMillis: target.connectTimeoutMs || DEFAULT_PROVISION_CONNECT_TIMEOUT_MS,
				// Names the session in pg_stat_activity, so a DBA can tell it from the API's own pool.
				application_name: 'gauzy-db-provision',
				statement_timeout: target.statementTimeoutMs,
				lock_timeout: target.lockTimeoutMs,
				keepAlive: target.keepAlive,
				keepAliveInitialDelayMillis: target.keepAliveInitialDelayMs
			});
			// A `pg` client emits `error` when its connection drops (a server restart, a network reset). Without a
			// listener Node turns that into an uncaught exception and ends the process. A query running at that
			// moment is rejected as well, and the stages below report that failure.
			client.on?.('error', () => undefined);
			await client.connect();
			return client;
		} catch (error) {
			const hint =
				(error as DriverError)?.code === PG_INVALID_CATALOG_NAME
					? ` Set DB_CREATE_MAINTENANCE_DB to a database the role "${target.user}" may connect to (e.g. template1).`
					: '';
			throw new DatabaseProvisionError(
				`could not connect to PostgreSQL at ${describeServer(target, POSTGRES_DEFAULT_PORT)} ` +
					`(database "${this.maintenanceDatabase}", role "${target.user}"): ${describeDriverError(error)}.${hint}`,
				'connect'
			);
		}
	}

	private async exists(client: PostgresAdminClient, target: DatabaseProvisionTarget): Promise<boolean> {
		try {
			const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [target.database]);
			return rows.length > 0;
		} catch (error) {
			throw new DatabaseProvisionError(
				`could not look up database "${target.database}" in pg_database: ${describeDriverError(error)}`,
				'check'
			);
		}
	}

	/** The lookup again, after a failed CREATE; if it fails too, the CREATE error is the one to report. */
	private async existsAfterFailedCreate(
		client: PostgresAdminClient,
		target: DatabaseProvisionTarget
	): Promise<boolean> {
		try {
			return await this.exists(client, target);
		} catch {
			return false;
		}
	}

	private async create(
		client: PostgresAdminClient,
		target: DatabaseProvisionTarget
	): Promise<DatabaseProvisionOutcome> {
		try {
			await client.query(`CREATE DATABASE ${quotePostgresIdentifier(target.database)}`);
			return 'created';
		} catch (error) {
			const code = (error as DriverError)?.code;
			// Another replica (or a person) may have created it since the lookup. PostgreSQL then says 42P04, or
			// 23505 when both statements raced on the catalog, or 42501 to a role that could not have created it
			// anyway: whatever the error, a database that exists now is all startup needs.
			if (code === PG_DUPLICATE_DATABASE || (await this.existsAfterFailedCreate(client, target))) {
				return 'exists';
			}
			const server = describeServer(target, POSTGRES_DEFAULT_PORT);
			const database = quotePostgresIdentifier(target.database);
			const role = quotePostgresIdentifier(target.user ?? '<role>');
			if (code === PG_INSUFFICIENT_PRIVILEGE) {
				throw new DatabaseProvisionError(
					`database ${database} does not exist on ${server}, and role ${role} may not create it: ` +
						`it needs the CREATEDB privilege. Grant it (ALTER ROLE ${role} CREATEDB;), or create the ` +
						`database yourself (CREATE DATABASE ${database} OWNER ${role};), or unset DB_CREATE_IF_NOT_EXISTS. ` +
						`PostgreSQL said: ${describeDriverError(error)}`,
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
