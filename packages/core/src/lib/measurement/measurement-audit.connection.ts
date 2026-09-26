import { Injectable, Optional } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { DataSource } from 'typeorm';
import { getORMType, MultiORMEnum } from '../core/utils';

/** The dialects an audit statement has to be quoted for. */
export type MeasurementAuditDialect = 'postgres' | 'mysql' | 'sqlite';

/**
 * What the measurement audit needs from a database, and nothing more.
 *
 * The audit reads counts and asks whether a table is there. It never writes, never joins through an
 * entity and never needs a transaction, so it depends on this rather than on either ORM's full data
 * source — which is also what lets its rules be tested against a stub instead of a database.
 *
 * A probe that cannot be answered returns `undefined` rather than a guess. The difference matters:
 * `false` means the column is not in this installation, so the reference is skipped silently;
 * `undefined` means the audit does not know, so it asks the database and reports what happened.
 */
export interface IMeasurementAuditConnection {
	/** The dialect the statements are quoted and written for. */
	readonly dialect: MeasurementAuditDialect;

	/** Whether the connection is usable at all. */
	readonly available: boolean;

	/**
	 * Runs a statement that returns one row holding one number.
	 *
	 * @param sql The statement.
	 * @returns The number, or 0 when the row carries none.
	 */
	count(sql: string): Promise<number>;

	/**
	 * Whether the connection has the table.
	 *
	 * @param table The table name, unquoted.
	 * @returns True or false when the connection can say, `undefined` when it cannot.
	 */
	hasTable(table: string): Promise<boolean | undefined>;

	/**
	 * Whether the connection has the column.
	 *
	 * @param table The table name, unquoted.
	 * @param column The column name, unquoted.
	 * @returns True or false when the connection can say, `undefined` when it cannot.
	 */
	hasColumn(table: string, column: string): Promise<boolean | undefined>;

	/**
	 * Quotes an identifier the way the connection's dialect does.
	 *
	 * @param identifier The table or column name.
	 * @returns The quoted identifier.
	 */
	quote(identifier: string): string;
}

/**
 * The audit's connection, over whichever ORM the installation selected.
 *
 * Both ORMs expose a global core module, so both can be injected optionally and exactly one of them
 * is used. The configured ORM is preferred, and the other is the fallback: an installation whose
 * `DB_ORM` names one ORM while both connections were started still audits the connection it actually
 * reads through.
 *
 * The existence probes are answered by TypeORM's catalogue reader, which every dialect it supports
 * implements. MikroORM's are not, and that is stated rather than worked around: on that ORM the
 * probes return `undefined`, the audit asks the database, and a reference whose table is absent is
 * reported as unavailable with the driver's own reason. A rule is therefore never silently skipped
 * on that ORM — it is either checked or named in the report as unchecked.
 */
@Injectable()
export class MeasurementAuditConnection implements IMeasurementAuditConnection {
	constructor(
		@Optional() private readonly dataSource?: DataSource,
		@Optional() private readonly mikroOrm?: MikroORM
	) {}

	/**
	 * Whether this connection can read.
	 *
	 * @returns True when one of the two ORMs was injected.
	 */
	get available(): boolean {
		return this.usesMikroOrm() || Boolean(this.dataSource);
	}

	/**
	 * The dialect the statements are written for.
	 *
	 * @returns The dialect. TypeORM's own spelling of it is mapped onto the three the audit writes
	 * for, and an unrecognised spelling falls back to `postgres`, whose statement form is the one
	 * both other dialects extend.
	 */
	get dialect(): MeasurementAuditDialect {
		if (this.usesMikroOrm()) {
			return this.mikroDialect();
		}

		switch (`${this.dataSource?.options?.type ?? ''}`.toLowerCase()) {
			case 'mysql':
			case 'mariadb':
				return 'mysql';
			case 'sqlite':
			case 'better-sqlite3':
			case 'sqljs':
				return 'sqlite';
			default:
				return 'postgres';
		}
	}

	/**
	 * Runs a single-number statement.
	 *
	 * @param sql The statement.
	 * @returns The number, or 0 when the row carries none.
	 */
	async count(sql: string): Promise<number> {
		if (this.usesMikroOrm()) {
			return readCount(await this.mikroOrm.em.getConnection().execute(sql));
		}

		if (!this.dataSource) {
			throw new Error('MEASUREMENT_AUDIT_NO_CONNECTION: neither ORM is available to the audit.');
		}

		return readCount(await this.dataSource.query(sql));
	}

	/**
	 * Whether the table is there, read from TypeORM's catalogue.
	 *
	 * @param table The table name, unquoted.
	 * @returns True or false, or `undefined` when this connection cannot say.
	 */
	async hasTable(table: string): Promise<boolean | undefined> {
		if (this.usesMikroOrm() || !this.dataSource) {
			return undefined;
		}

		const runner = this.dataSource.createQueryRunner();

		try {
			return await runner.hasTable(table);
		} finally {
			await runner.release();
		}
	}

	/**
	 * Whether the column is there, read from TypeORM's catalogue.
	 *
	 * @param table The table name, unquoted.
	 * @param column The column name, unquoted.
	 * @returns True or false, or `undefined` when this connection cannot say.
	 */
	async hasColumn(table: string, column: string): Promise<boolean | undefined> {
		if (this.usesMikroOrm() || !this.dataSource) {
			return undefined;
		}

		const runner = this.dataSource.createQueryRunner();

		try {
			return await runner.hasColumn(table, column);
		} finally {
			await runner.release();
		}
	}

	/**
	 * Quotes an identifier.
	 *
	 * @param identifier The table or column name.
	 * @returns The quoted identifier.
	 */
	quote(identifier: string): string {
		if (this.usesMikroOrm()) {
			return this.mikroOrm.em.getPlatform().quoteIdentifier(identifier);
		}

		return this.dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
	}

	/**
	 * Whether the MikroORM branch is the one in use.
	 *
	 * @returns True when the configured ORM is MikroORM and its connection was injected, or when it
	 * is the only connection there is.
	 */
	private usesMikroOrm(): boolean {
		if (!this.mikroOrm) {
			return false;
		}

		return getORMType() === MultiORMEnum.MikroORM || !this.dataSource;
	}

	/**
	 * The dialect MikroORM is connected to, read from its platform rather than guessed.
	 *
	 * @returns The dialect.
	 */
	private mikroDialect(): MeasurementAuditDialect {
		const platform = this.mikroOrm.em.getPlatform();

		switch (platform.constructor.name) {
			case 'MySqlPlatform':
			case 'MariaDbPlatform':
				return 'mysql';
			case 'SqlitePlatform':
			case 'BetterSqlitePlatform':
				return 'sqlite';
			default:
				return 'postgres';
		}
	}
}

/**
 * Reads the number out of a single-row result.
 *
 * The three drivers disagree about what they hand back for one scalar — a number, a decimal string,
 * an array of rows, or an object keyed by the statement's alias — so the value is taken from the
 * first row's first field rather than from a key, which is the only part all three agree on.
 *
 * @param rows Whatever the driver returned.
 * @returns The number, or 0 when none could be read.
 */
export function readCount(rows: unknown): number {
	const row = Array.isArray(rows) ? rows[0] : rows;

	if (row === null || row === undefined) {
		return 0;
	}

	const value = typeof row === 'object' ? Object.values(row as Record<string, unknown>)[0] : row;
	const count = Number(value);

	return Number.isFinite(count) ? count : 0;
}
