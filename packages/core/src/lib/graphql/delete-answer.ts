/**
 * Whether a hard delete removed anything — the answer a GraphQL delete field gives.
 *
 * `TenantAwareCrudService.delete`, the kernel's hard delete that almost every service inherits, performs no
 * existence check: an identifier that names no row of the caller is a statement that matches nothing, and it
 * answers `{ affected: 0 }` without raising. The REST route hands that result to its client as it is, so
 * `DELETE /:id` of a missing row reports "0 affected". A field that awaited the same call, dropped the result
 * and answered `true` said the row was removed when nothing was (handover 2026-09-20 §7.65 item 21). This is
 * the one reading of the result every such field shares, so the two surfaces say the same thing about the
 * same statement: `true` when it removed a row, `false` when it matched none.
 *
 * A result that carries no count is not a statement about rows: a service whose own `delete` answers the
 * removed row, or nothing, either removed it or raised — so it reads as removed. A count the driver did not
 * report (`affected` left `undefined`/`null`) is read the same way, rather than as a removal that did not
 * happen; every driver the platform ships (`pg`, `mysql2`, `better-sqlite3`, MikroORM's `nativeDelete`)
 * reports it.
 *
 * @param result What the service's `delete` answered.
 * @returns Whether the delete removed at least one row.
 */
export function deleteRemovedRows(result: unknown): boolean {
	// A bare count, as a raw MikroORM `nativeDelete` answers it.
	if (typeof result === 'number') {
		return result > 0;
	}

	if (result === null || typeof result !== 'object' || !('affected' in result)) {
		return true;
	}

	const affected = (result as { affected?: unknown }).affected;

	return typeof affected === 'number' ? affected > 0 : true;
}
