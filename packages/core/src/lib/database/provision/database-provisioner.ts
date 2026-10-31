/**
 * Creating the configured database when it is missing (`DB_CREATE_IF_NOT_EXISTS`).
 *
 * TypeORM, MikroORM and Knex all connect to a database that must already exist: pointed at a PostgreSQL or MySQL
 * server that does not have it yet, the API fails with "database ... does not exist". A provisioner is the one
 * step that closes that gap. It connects to the SERVER rather than to the database, checks whether the database
 * exists and creates it when it does not. It never drops, alters or empties anything.
 *
 * Each database engine has its own provisioner (see `postgres-database.provisioner.ts` and
 * `mysql-database.provisioner.ts`), selected by `DB_TYPE` in `ensure-database-exists.ts`; supporting another
 * engine means writing one more class against this interface, nothing else.
 */

/**
 * Where the database lives and how to reach its server, taken from the connection options the ORM is about to
 * use (see `toDatabaseProvisionTarget`), so the check runs with exactly the same host, credentials and TLS.
 */
export interface DatabaseProvisionTarget {
	/** The `DB_TYPE` of the server, e.g. `postgres` or `mysql`. */
	readonly type: string;
	/** The database to make sure of (`DB_NAME`). */
	readonly database: string;
	readonly host?: string;
	readonly port?: number;
	readonly user?: string;
	/** Passed to the driver as it is: `pg` also accepts a function that returns the password. */
	readonly password?: unknown;
	/** The driver's TLS options (`DB_SSL_MODE` / `DB_CA_CERT`), passed to the driver as they are. */
	readonly ssl?: unknown;
	/** How long to wait for the server to accept the connection, in milliseconds. */
	readonly connectTimeoutMs?: number;
}

/**
 * Used when the connection options carry no connect timeout: `pg` itself would otherwise wait for as long as TCP
 * does on an unreachable host.
 */
export const DEFAULT_PROVISION_CONNECT_TIMEOUT_MS = 10_000;

/** What a provisioner found: the database was already there, or it created it. */
export type DatabaseProvisionOutcome = 'exists' | 'created';

/** Creates the configured database when it is missing. */
export interface DatabaseProvisioner {
	/**
	 * Checks whether `target.database` exists on the server and creates it when it does not.
	 *
	 * @throws {DatabaseProvisionError} naming the stage that failed.
	 */
	ensureDatabase(target: DatabaseProvisionTarget): Promise<DatabaseProvisionOutcome>;
}

/**
 * The step of the provisioning that failed.
 *
 * - `config`: the configured database name cannot be a database name (empty, too long, a NUL byte).
 * - `connect`: the server could not be reached or refused the credentials.
 * - `check`: connected, but the existence check failed.
 * - `create`: the database does not exist and could not be created (typically a missing privilege).
 */
export type DatabaseProvisionStage = 'config' | 'connect' | 'check' | 'create';

/**
 * A provisioning failure, with the stage it happened at and a message meant for the operator.
 *
 * The driver's error is deliberately NOT attached as `cause`: its message is already in `message`, and the error
 * object itself may carry connection parameters that are printed with the stack when startup fails.
 */
export class DatabaseProvisionError extends Error {
	constructor(
		message: string,
		readonly stage: DatabaseProvisionStage
	) {
		super(message);
		this.name = 'DatabaseProvisionError';
	}
}

/** A driver error as both drivers shape it: `pg` sets a SQLSTATE `code`, `mysql2` a symbolic `code` and an `errno`. */
export interface DriverError {
	code?: string;
	errno?: number;
	message?: string;
}

/**
 * The driver's own message for an error, never the error object itself: a driver error can carry the connection
 * parameters it was given, and those include the password.
 */
export function describeDriverError(error: unknown): string {
	const message = (error as DriverError)?.message;
	return typeof message === 'string' && message.trim() ? message.trim() : String(error);
}

/**
 * `host:port` for messages, with each driver's default filled in, so an operator reads where the check went.
 */
export function describeServer(target: DatabaseProvisionTarget, defaultPort: number): string {
	return `${target.host || 'localhost'}:${target.port || defaultPort}`;
}
