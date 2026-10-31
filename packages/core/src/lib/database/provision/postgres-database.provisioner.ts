import { assertValidDatabaseName, POSTGRES_MAX_DATABASE_NAME_BYTES, quotePostgresIdentifier } from './database-identifier';
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

/** The part of a `pg` `Client` the provisioner uses. */
export interface PostgresAdminClient {
	connect(): Promise<unknown>;
	query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
	end(): Promise<unknown>;
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
 */
export class PostgresDatabaseProvisioner implements DatabaseProvisioner {
	private readonly maintenanceDatabase: string;
	private readonly createClient: PostgresAdminClientFactory;

	constructor({ maintenanceDatabase, createClient }: PostgresDatabaseProvisionerOptions = {}) {
		this.maintenanceDatabase = maintenanceDatabase?.trim() || DEFAULT_POSTGRES_MAINTENANCE_DATABASE;
		this.createClient = createClient ?? createPgAdminClient;
	}

	async ensureDatabase(target: DatabaseProvisionTarget): Promise<DatabaseProvisionOutcome> {
		assertValidDatabaseName(target.database, { maxBytes: POSTGRES_MAX_DATABASE_NAME_BYTES });

		const client = await this.connect(target);
		try {
			if (await this.exists(client, target)) {
				return 'exists';
			}
			return await this.create(client, target);
		} finally {
			// Closing must never hide the outcome (or the error) above.
			await client.end().catch(() => undefined);
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
				connectionTimeoutMillis: target.connectTimeoutMs || DEFAULT_PROVISION_CONNECT_TIMEOUT_MS,
				// Names the session in pg_stat_activity, so a DBA can tell it from the API's own pool.
				application_name: 'gauzy-db-provision'
			});
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

	private async create(client: PostgresAdminClient, target: DatabaseProvisionTarget): Promise<DatabaseProvisionOutcome> {
		try {
			await client.query(`CREATE DATABASE ${quotePostgresIdentifier(target.database)}`);
			return 'created';
		} catch (error) {
			const code = (error as DriverError)?.code;
			// Another replica (or a person) created it between the lookup and this statement: it exists now.
			if (code === PG_DUPLICATE_DATABASE) {
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
