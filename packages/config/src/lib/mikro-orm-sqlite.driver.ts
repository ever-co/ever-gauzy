import { Configuration } from '@mikro-orm/core';
import {
	BetterSqliteConnection,
	BetterSqliteDriver,
	BetterSqliteKnexDialect,
	BetterSqlitePlatform
} from '@mikro-orm/better-sqlite';

/**
 * A date as TypeORM stores it in SQLite: UTC, `YYYY-MM-DD HH:MM:SS.SSS` (TypeORM's `mixedDateToUtcDatetimeString`).
 *
 * @param date The date.
 * @returns The stored text.
 */
export function toTypeOrmSqliteDate(date: Date): string {
	return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * The knex dialect MikroORM's SQLite connection runs its statements through, binding a `Date` as TypeORM's text.
 *
 * knex's better-sqlite3 dialect binds a `Date` as its epoch milliseconds (`binding.valueOf()`), and so did every
 * date MikroORM wrote or compared on SQLite — the values of an INSERT or UPDATE, and the parameter of every `where`
 * on a date. TypeORM stores the same columns as UTC text, and SQLite orders every number before every text, so a
 * MikroORM predicate such as `expiresAt < :now` never matched a row TypeORM wrote (the seeder's, the migrations',
 * the services still on TypeORM), and TypeORM's never matched MikroORM's.
 */
class TypeOrmDatesKnexDialect extends BetterSqliteKnexDialect {
	_formatBindings(bindings: unknown[]): unknown[] {
		return (BetterSqliteKnexDialect.prototype as any)._formatBindings.call(
			this,
			bindings?.map((binding) => (binding instanceof Date ? toTypeOrmSqliteDate(binding) : binding))
		);
	}
}

/** MikroORM's SQLite connection, through {@link TypeOrmDatesKnexDialect}. */
class TypeOrmDatesSqliteConnection extends BetterSqliteConnection {
	override createKnex(): void {
		this.client = this.createKnexClient(TypeOrmDatesKnexDialect as any);
		this.connected = true;
	}
}

/**
 * MikroORM's SQLite platform, writing a `Date` into SQL as TypeORM's text where it wrote epoch milliseconds.
 *
 * - `quoteValue` is how MikroORM inlines a parameter into a statement — every `where` value, and the values of an
 *   INSERT or UPDATE it formats itself. SQLite's platform wrote a `Date` as `+value`.
 * - `processDateProperty` is what a change set carries into an INSERT or UPDATE, and what MikroORM snapshots a date
 *   as. SQLite's platform answered the number; it now leaves the `Date` as it is, so the statement quotes it as text.
 *   MikroORM diffs a date property by `valueOf()`, so a `Date` snapshot against a loaded `Date` still reads as
 *   unchanged (a string would not).
 */
class TypeOrmDatesSqlitePlatform extends BetterSqlitePlatform {
	override processDateProperty(value: unknown): string | number {
		return value as string | number;
	}

	override quoteValue(value: any): string {
		return super.quoteValue(value instanceof Date ? toTypeOrmSqliteDate(value) : value);
	}
}

/**
 * MikroORM's better-sqlite3 driver, storing and comparing dates as TypeORM does on the same database.
 *
 * Under `DB_ORM=mikro-orm` both ORMs run on one SQLite file: TypeORM writes the migrations' defaults, the seed, and
 * whatever the services still on TypeORM write. MikroORM's own driver wrote dates as epoch milliseconds and read
 * TypeORM's text as local time, so on a machine an hour east of UTC a token TypeORM stored as expiring at 00:00Z read
 * back as 23:00Z the day before, and date predicates never crossed between the two formats. With this driver
 * MikroORM writes and binds TypeORM's UTC text, and — with `forceUtcTimezone`, which the SQLite profile sets — reads
 * text without an offset as UTC. A number (a date written as epoch milliseconds) still reads back as the same
 * instant.
 *
 * It is a `BetterSqliteDriver`, so everything that recognises that driver (`getDBType`, MikroORM's own checks)
 * recognises this one; only its platform and connections are replaced.
 */
export class TypeOrmCompatibleBetterSqliteDriver extends BetterSqliteDriver {
	constructor(config: Configuration) {
		super(config);

		const driver = this as any;
		driver.platform = new TypeOrmDatesSqlitePlatform();
		driver.connection = new TypeOrmDatesSqliteConnection(driver.config);
		driver.replicas = driver.createReplicas(
			(replica: unknown) => new TypeOrmDatesSqliteConnection(driver.config, replica as any, 'read')
		);
	}
}
