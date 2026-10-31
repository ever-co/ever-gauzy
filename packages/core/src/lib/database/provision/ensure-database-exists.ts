import { Logger, LoggerService } from '@nestjs/common';
import { DatabaseTypeEnum } from '@gauzy/config';
import { parseToBoolean } from '@gauzy/utils';
import {
	DatabaseProvisioner,
	DatabaseProvisionError,
	DatabaseProvisionOutcome,
	DatabaseProvisionTarget,
	DEFAULT_PROVISION_CONNECT_TIMEOUT_MS,
	describeDriverError
} from './database-provisioner';
import { MySqlDatabaseProvisioner } from './mysql-database.provisioner';
import { PostgresDatabaseProvisioner } from './postgres-database.provisioner';

/**
 * `DB_CREATE_IF_NOT_EXISTS=true` (#1769): before the ORM connects, create the configured PostgreSQL or MySQL database
 * (`DB_NAME`) when the server does not have it yet, so a fresh server needs no manual `CREATE DATABASE`.
 *
 * Off by default, and while it is off nothing connects and nothing is logged: an existing deployment behaves
 * exactly as before. When it is on:
 *
 * - the database exists: one short connection, one lookup, nothing else;
 * - it is missing: it is created (only it: nothing is ever dropped or altered);
 * - it is missing and cannot be created (no CREATEDB / CREATE privilege, an invalid `DB_NAME`): startup stops with
 *   a message naming the privilege and the statement to run, instead of the ORM's retries ending in
 *   "database ... does not exist";
 * - the server cannot be reached, the lookup fails, or the server does not answer within
 *   {@link PROVISION_WORK_BUDGET_MS} after the connect timeout: a warning, and startup goes on exactly as without
 *   the flag, so the ORM reports (and retries) the connection as it always did. A role that may not connect to the
 *   maintenance database but may connect to its own still starts.
 *
 * SQLite needs none of this: the driver creates its file on first use.
 */
export function isDatabaseCreationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return parseToBoolean(env.DB_CREATE_IF_NOT_EXISTS);
}

/** The provisioner of each `DB_TYPE` that has one. */
export type DatabaseProvisionerRegistry = Readonly<Partial<Record<string, DatabaseProvisioner>>>;

/**
 * The built-in provisioners: PostgreSQL (maintenance database from `DB_CREATE_MAINTENANCE_DB`) and MySQL.
 * A caller that needs another engine passes its own registry to {@link ensureDatabaseExists}.
 */
export function createDatabaseProvisioners(env: NodeJS.ProcessEnv = process.env): DatabaseProvisionerRegistry {
	return {
		[DatabaseTypeEnum.postgres]: new PostgresDatabaseProvisioner({
			maintenanceDatabase: env.DB_CREATE_MAINTENANCE_DB
		}),
		[DatabaseTypeEnum.mysql]: new MySqlDatabaseProvisioner()
	};
}

/**
 * The fields of the TypeORM connection options (`dbConnectionOptions`) the provisioning reads. Built by
 * `@gauzy/config` from `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASS` / `DB_SSL_MODE`, and possibly
 * changed by a plugin after that, which is why they are read from the final options rather than from the
 * environment.
 */
export interface DatabaseConnectionOptionsLike {
	type?: string;
	host?: string;
	port?: number;
	username?: string;
	password?: unknown;
	database?: unknown;
	ssl?: unknown;
	/** A connection URL (`postgres://user:password@host:5432/gauzy`); its fields win over the separate ones. */
	url?: unknown;
	/** The driver options; for PostgreSQL, `postgresConnectionExtras` in `@gauzy/config` fills the session ones. */
	extra?: {
		connectionTimeoutMillis?: number;
		statement_timeout?: unknown;
		lock_timeout?: unknown;
		keepAlive?: unknown;
		keepAliveInitialDelayMillis?: unknown;
	};
}

/** A positive number of milliseconds, or `undefined` for anything else (unset, `0`, a string). */
function positiveMs(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** `decodeURIComponent` that leaves a malformed sequence as it is instead of throwing. */
function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

type ConnectionFields = Pick<DatabaseConnectionOptionsLike, 'host' | 'port' | 'username' | 'password' | 'database'>;

/**
 * The connection fields a `url` option carries. TypeORM lets them win over the separate fields (a plugin may
 * configure the connection with a URL alone), so the provisioning reads them the same way. A URL that does not
 * parse adds nothing.
 */
function connectionUrlFields(url: unknown): ConnectionFields {
	if (typeof url !== 'string' || url.trim() === '') {
		return {};
	}
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return {};
	}
	const fields: ConnectionFields = {
		// An IPv6 host comes bracketed (`[::1]`); the drivers take it bare.
		host: parsed.hostname.replace(/^\[(.*)\]$/, '$1') || undefined,
		port: parsed.port ? Number(parsed.port) : undefined,
		username: parsed.username ? safeDecode(parsed.username) : undefined,
		password: parsed.password ? safeDecode(parsed.password) : undefined,
		database: parsed.pathname.length > 1 ? safeDecode(parsed.pathname.slice(1)) : undefined
	};
	return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as ConnectionFields;
}

/** The provisioning target described by the ORM's connection options. */
export function toDatabaseProvisionTarget(options: DatabaseConnectionOptionsLike): DatabaseProvisionTarget {
	const extra = options?.extra;
	const fields: ConnectionFields = { ...options, ...connectionUrlFields(options?.url) };
	return {
		type: String(options?.type ?? ''),
		// SQLite's `database` is a file path (or a buffer for sql.js); only a networked engine's name is used.
		database: typeof fields.database === 'string' ? fields.database : '',
		host: fields.host,
		port: fields.port,
		user: fields.username,
		password: fields.password,
		ssl: options?.ssl,
		connectTimeoutMs: extra?.connectionTimeoutMillis,
		statementTimeoutMs: positiveMs(extra?.statement_timeout),
		lockTimeoutMs: positiveMs(extra?.lock_timeout),
		keepAlive: typeof extra?.keepAlive === 'boolean' ? extra.keepAlive : undefined,
		keepAliveInitialDelayMs: positiveMs(extra?.keepAliveInitialDelayMillis)
	};
}

/**
 * - `disabled`: `DB_CREATE_IF_NOT_EXISTS` is not `true`; nothing was done.
 * - `not-applicable`: the `DB_TYPE` has no provisioner (SQLite creates its own file).
 * - `unverified`: the server could not be asked; startup continues as without the flag.
 * - `exists` / `created`: see {@link DatabaseProvisionOutcome}.
 */
export type EnsureDatabaseExistsResult = 'disabled' | 'not-applicable' | 'unverified' | DatabaseProvisionOutcome;

export interface EnsureDatabaseExistsOptions {
	/** Defaults to `process.env`. */
	env?: NodeJS.ProcessEnv;
	/** Defaults to a Nest `Logger` with the `DatabaseProvision` context. */
	logger?: Pick<LoggerService, 'log' | 'warn'>;
	/** Defaults to {@link createDatabaseProvisioners}. */
	provisioners?: DatabaseProvisionerRegistry;
	/**
	 * How long to wait for the provisioner before startup goes on without it, in milliseconds. Defaults to the
	 * connect timeout plus {@link PROVISION_WORK_BUDGET_MS}.
	 */
	timeoutMs?: number;
}

/**
 * How long the lookup and the `CREATE DATABASE` may take, on top of the connect timeout, before startup goes on
 * without them. Both take well under a second on a healthy server; this bounds a server that accepted the
 * connection and then stopped answering, or a statement left waiting on a lock, so they cannot hold startup.
 */
export const PROVISION_WORK_BUDGET_MS = 60_000;

const TIMED_OUT = Symbol('timed out');

/** Only a database that is known to be missing and could not be created stops startup. */
function isFatal(error: unknown): error is DatabaseProvisionError {
	return error instanceof DatabaseProvisionError && (error.stage === 'create' || error.stage === 'config');
}

/**
 * Creates the configured database when `DB_CREATE_IF_NOT_EXISTS=true` and it is missing; see
 * {@link isDatabaseCreationEnabled} for the whole behaviour.
 *
 * @param connectionOptions - The TypeORM connection options the application is about to connect with.
 * @returns What was found or done.
 * @throws {DatabaseProvisionError} when the database is missing and could not be created, or `DB_NAME` is invalid.
 */
export async function ensureDatabaseExists(
	connectionOptions: DatabaseConnectionOptionsLike,
	{
		env = process.env,
		logger = new Logger('DatabaseProvision'),
		provisioners,
		timeoutMs
	}: EnsureDatabaseExistsOptions = {}
): Promise<EnsureDatabaseExistsResult> {
	if (!isDatabaseCreationEnabled(env)) {
		return 'disabled';
	}

	const target = toDatabaseProvisionTarget(connectionOptions);
	const provisioner = (provisioners ?? createDatabaseProvisioners(env))[target.type];
	if (!provisioner) {
		const sqlite = target.type === DatabaseTypeEnum.sqlite || target.type === DatabaseTypeEnum.betterSqlite3;
		logger.log(
			sqlite
				? 'DB_CREATE_IF_NOT_EXISTS: nothing to do, SQLite creates its database file on first use.'
				: `DB_CREATE_IF_NOT_EXISTS: creating a database is not supported for DB_TYPE "${target.type}"; skipped.`
		);
		return 'not-applicable';
	}

	const deadlineMs =
		timeoutMs ?? (target.connectTimeoutMs || DEFAULT_PROVISION_CONNECT_TIMEOUT_MS) + PROVISION_WORK_BUDGET_MS;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
		timer = setTimeout(() => resolve(TIMED_OUT), deadlineMs);
	});
	try {
		// The race also handles a late rejection of the provisioner, so nothing it does after the deadline can
		// surface as an unhandled rejection; its connection is closed whenever it finishes.
		const outcome = await Promise.race([provisioner.ensureDatabase(target), deadline]);
		if (outcome === TIMED_OUT) {
			logger.warn(
				`DB_CREATE_IF_NOT_EXISTS: the database server did not answer within ${Math.ceil(deadlineMs / 1000)}s, ` +
					`so database "${target.database}" may not have been created. Startup continues; the database ` +
					`connection reports the cause if it fails as well.`
			);
			return 'unverified';
		}
		logger.log(
			outcome === 'created'
				? `DB_CREATE_IF_NOT_EXISTS: created database "${target.database}".`
				: `DB_CREATE_IF_NOT_EXISTS: database "${target.database}" exists.`
		);
		return outcome;
	} catch (error) {
		if (isFatal(error)) {
			throw new DatabaseProvisionError(`DB_CREATE_IF_NOT_EXISTS: ${error.message}`, error.stage);
		}
		logger.warn(
			`DB_CREATE_IF_NOT_EXISTS: could not check whether database "${target.database}" exists, so it was not ` +
				`created (${describeDriverError(error)}). Startup continues; the database connection reports the ` +
				`cause if it fails as well.`
		);
		return 'unverified';
	} finally {
		clearTimeout(timer);
	}
}
