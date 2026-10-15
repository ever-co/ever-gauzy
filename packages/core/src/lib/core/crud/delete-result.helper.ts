/**
 * Whether a delete removed anything: the answer a `delete*` GraphQL field gives.
 *
 * `CrudService.delete` and `TenantAwareCrudService.delete` hand back the store's `DeleteResult` without
 * reading the row first, so an identifier that names no row — or another tenant's row, which the tenant
 * scope leaves out of the statement — is not an error: the statement runs and reports `affected: 0`. The
 * REST route returns that result as it is. A field that awaited the same call and then answered `true`
 * told its caller a row had gone when none had, which is the answer this replaces: it is read from the
 * count the statement reports, exactly as the cart, fulfillment and order fields read it
 * (`Number(result?.affected ?? 0) > 0`).
 *
 * The count is reported on every store the platform runs on — PostgreSQL's `rowCount`, MySQL's
 * `affectedRows`, better-sqlite3's `changes` (TypeORM's `sqlite` type is better-sqlite3), and the number
 * MikroORM's `nativeDelete` returns — for an `UPDATE` (a soft delete's `UpdateResult`) as well as a
 * `DELETE`, so a removal that happened is never answered `false`. A bulk removal answers `true` once it
 * removed at least one row.
 *
 * Typed to take any object rather than only a `DeleteResult` because several services declare a union
 * (`DeleteResult | Entity`) for a method that only ever returns the result; what it refuses is `void`, the
 * type of a call that has no count to read.
 *
 * @param result The delete result (or the soft delete's `UpdateResult`), or nothing at all.
 * @returns `true` when at least one row was affected.
 */
export function answersDeleted(result: object | null | undefined): boolean {
	return Number((result as { affected?: unknown } | null | undefined)?.affected ?? 0) > 0;
}
