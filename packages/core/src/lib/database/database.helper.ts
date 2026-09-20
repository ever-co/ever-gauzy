import { isMySQL, isPostgres } from '@gauzy/config';

/**
 *
 * @Desc Used to replace double quotes " with backticks ` in case the selected DB type is MySQL
 */
export const prepareSQLQuery = (queryStr: string): string => {
	if (isMySQL()) {
		return queryStr.replace(/"/g, '`');
	}
	return queryStr;
}

/**
 * Quotes one identifier the way the configured dialect does.
 *
 * `prepareSQLQuery` above rewrites a whole statement, which is right when the statement is written
 * once and every double quote in it is an identifier. It is wrong when a fragment is assembled from
 * parts, or when the statement also carries a quoted string literal, because it cannot tell the two
 * apart. This quotes exactly what it is given, so a fragment can be built without a rewrite pass
 * over it afterwards.
 *
 * Both spellings matter: MySQL reads `"quantity"` as the *string* `quantity`, not as the column, so
 * `SET quantity = "quantity" + 1` silently writes `1` — the write succeeds, the aggregate is
 * destroyed and nothing is reported. That is the failure this exists to make impossible.
 *
 * @param identifier The table, column or alias name.
 * @returns The identifier, quoted for the configured dialect.
 */
export const quoteIdentifier = (identifier: string): string =>
	isMySQL() ? `\`${identifier}\`` : `"${identifier}"`;

/**
 * The dialect's expression for "now", at the precision the platform's timestamps carry.
 *
 * @returns The expression.
 */
export const currentTimestampExpression = (): string => (isMySQL() ? 'CURRENT_TIMESTAMP(6)' : 'now()');

/**
 * The dialect's spelling of a boolean literal.
 *
 * MySQL has no boolean type — `TRUE` is an alias for `1` and works, but a driver that compares a
 * `tinyint(1)` against the *string* `'true'` does not. The literal is written as the column's own
 * storage so the comparison is never a coercion.
 *
 * @param value The boolean.
 * @returns The literal.
 */
export const booleanLiteral = (value: boolean): string => {
	if (isMySQL()) {
		return value ? '1' : '0';
	}

	return value ? 'true' : 'false';
};

/** A statement rewritten into the placeholder form the configured driver binds. */
export interface IPositionalStatement {
	/** The statement, with every `:name` replaced by the driver's own placeholder. */
	sql: string;
	/** The values, in the order the placeholders appear. */
	parameters: unknown[];
}

/**
 * Rewrites a statement's named parameters into the positional form the driver binds.
 *
 * **Nothing below `QueryBuilder` understands `:name`.** `Repository.query()`, `EntityManager.query()`
 * and MikroORM's `Connection.execute()` all hand the statement to the driver untouched, and every
 * driver the platform supports binds positionally — `$1, $2, …` for Postgres, `?` for MySQL and for
 * both SQLite drivers. A statement written with named parameters and handed an array of values
 * therefore binds nothing: Postgres and MySQL raise a syntax error at the colon, and the embedded
 * drivers refuse the statement because it declares no placeholder the array can fill. Named
 * parameters read far better than a bare `?`, so the answer is to keep writing them and rewrite them
 * here rather than to give them up.
 *
 * A name used more than once is bound once per occurrence, in the order the occurrences appear, so a
 * statement that compares `used + :amount` against a ceiling and then adds the same `:amount` to the
 * column carries the figure twice. Postgres could reuse one placeholder for both, but numbering every
 * occurrence keeps one values array correct for all four drivers.
 *
 * A `:name` for which no value was supplied is left alone rather than bound to `undefined`, because
 * `::` casts and a Postgres time literal both contain a colon and neither is a parameter.
 *
 * @param sql The statement, written with `:name` parameters.
 * @param parameters The values, keyed by name.
 * @returns The statement in the driver's placeholder form, and its values in matching order.
 */
export const toPositionalStatement = (sql: string, parameters: Record<string, unknown>): IPositionalStatement => {
	const values: unknown[] = [];
	// `(?<!:)` leaves a `::` cast alone; `\b` stops the name short of a trailing character that is
	// not part of it.
	const positional = sql.replace(/(?<!:):(\w+)\b/g, (match: string, name: string) => {
		if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
			return match;
		}

		values.push(parameters[name]);

		return isPostgres() ? `$${values.length}` : '?';
	});

	return { sql: positional, parameters: values };
};

/**
 * How many rows a statement changed, whichever driver answered.
 *
 * The four drivers disagree completely about what a write returns. `pg` answers an object carrying
 * `rowCount`; TypeORM's MySQL driver answers `[ResultSetHeader]` whose `affectedRows` is the count;
 * TypeORM's raw `query` on MySQL and on SQLite answers `[rows, affected]` for a statement that
 * changes rows; and MikroORM's `Connection.execute(..., 'run')` answers the count itself. A service
 * that reads one of those shapes is a service that reports "nothing changed" on the other three —
 * and a conditional `UPDATE` whose affected-row count reads as zero is indistinguishable from a
 * refusal, which is how a write that landed is reported to the caller as a conflict.
 *
 * @param result Whatever the driver returned.
 * @returns The affected-row count, or 0 when the shape carries none.
 */
export const readAffectedRows = (result: unknown): number => {
	if (typeof result === 'number') {
		return Number.isFinite(result) ? result : 0;
	}

	if (Array.isArray(result)) {
		// `[rows, affected]` from TypeORM's raw query, or `[ResultSetHeader]` from the MySQL driver.
		const [first, second] = result as unknown[];

		if (typeof second === 'number') {
			return second;
		}

		const header = first as { affectedRows?: unknown; changedRows?: unknown } | undefined;

		if (typeof header?.affectedRows === 'number') {
			return header.affectedRows;
		}

		return 0;
	}

	const candidate = result as { affected?: unknown; rowCount?: unknown; affectedRows?: unknown } | null | undefined;

	for (const value of [candidate?.affected, candidate?.rowCount, candidate?.affectedRows]) {
		if (typeof value === 'number') {
			return value;
		}
	}

	return 0;
};
