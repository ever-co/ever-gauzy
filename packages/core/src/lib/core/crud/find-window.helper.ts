/**
 * The page a find-options object states, read the same way under both ORMs.
 *
 * `CrudService` has two read families that both take `skip` and `take`, and they mean different things by
 * `skip`:
 *
 * - `findAll` and `find` take a **row offset**: `skip: 20` passes over twenty rows. That is what TypeORM's
 *   own `skip` is, and what every caller of these two methods hands them — the store-paged GraphQL
 *   connections (`resolveConnectionWindow` answers a row offset), and the services that turn a page number
 *   into an offset before they call (`take * (page - 1)`).
 * - `paginate` takes a **page number**: `skip: 2` is the second page, and its TypeORM branch multiplies it
 *   out itself.
 *
 * The MikroORM branches of all three go through the shared `parseTypeORMFindToMikroOrm`, which converts
 * `skip` as a page number (`offset = take * (skip - 1)`) because `paginate` needs it to. `findAll` and `find`
 * therefore read the same `skip` two ways depending on `DB_ORM`: `findAll({ skip: 20, take: 20 })` read rows
 * 20-39 under TypeORM and rows 380-399 under MikroORM, and a connection that labelled the page as starting
 * at row 20 walked straight past everything in between. The parser is shared with `paginate` and with the
 * hand-written paginators that call it directly, so it keeps its page-number reading; these helpers restore
 * the row-offset reading on the two read methods whose contract it is.
 */

/**
 * The row offset a find-options object states, as a count of rows to pass over.
 *
 * Read defensively, because the options often arrive from a query string: a numeric string is the number it
 * spells, and anything that is not a positive number states no offset — which is what TypeORM does with a
 * `skip` of zero, and what the parser did with every falsy one.
 *
 * @param options The find options, or nothing.
 * @returns The offset, or `undefined` when none is stated.
 */
export function statedRowOffset(options?: unknown): number | undefined {
	const skip = Number((options as { skip?: unknown } | null | undefined)?.skip);

	return Number.isFinite(skip) && skip > 0 ? Math.trunc(skip) : undefined;
}

/**
 * Makes a parsed MikroORM read pass over `skip` rows, as TypeORM does.
 *
 * Called on the options `parseTypeORMFindToMikroOrm` produced, so everything else it parsed — the criteria,
 * the populate list, the order, `withDeleted` — is kept, and only the offset it derived from a page number is
 * replaced by the row offset the caller stated.
 *
 * @param mikroOptions The parsed MikroORM options; modified in place.
 * @param options The find options they were parsed from.
 * @returns The same MikroORM options, for chaining.
 */
export function applyRowOffset<O extends { offset?: number }>(mikroOptions: O, options?: unknown): O {
	const offset = statedRowOffset(options);

	if (offset === undefined) {
		delete mikroOptions.offset;
	} else {
		mikroOptions.offset = offset;
	}

	return mikroOptions;
}

/**
 * Whether a find-options object asks for an empty window: `take` stated as zero.
 *
 * A window of no rows is a real request — `resolveConnectionWindow` answers one for a backward walk from the
 * first row, where nothing lies before the cursor — and neither ORM reliably reads it as one. MikroORM drops a
 * falsy `limit` outright. TypeORM writes `LIMIT 0` for a plain read, but drops the zero when the read joins a
 * relation and states no `skip`: its paginated two-query path only runs for a truthy `skip` or `take`, and the
 * single query it falls back to takes no limit from a joined read. Both therefore turned "no rows" into
 * "every row" — an unbounded read of the table — on at least one path. Only a `take` that is stated and is
 * zero counts: an absent `take` still means no limit, as it always has.
 *
 * @param options The find options, or nothing.
 * @returns True when the caller asked for zero rows.
 */
export function statesEmptyWindow(options?: unknown): boolean {
	const take = (options as { take?: unknown } | null | undefined)?.take;

	if (take === undefined || take === null || take === '') {
		return false;
	}

	return Number(take) === 0;
}
