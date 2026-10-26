import { BadRequestException } from '@nestjs/common';

/**
 * The refusal every edit, removal, retirement or restore of an order ledger row answers with (review R3-11).
 *
 * `order_transaction` (the payment ledger), `order_history` (the timeline) and `order_summary` (the totals history)
 * are append-only by their own declarations - "a correction is a new row of the opposite kind, never an edit and never
 * a deletion" - and `recompute` derives the order's money state from the live rows. The generic routes still edited
 * them (`PUT`), and retired and restored them (`DELETE`, `DELETE :id/soft`, `PUT :id/recover` and the GraphQL
 * mirrors): a retired ledger row dropped out of the next derivation with no re-derivation of its own, and an edited
 * one rewrote what the order had been paid. The rows are kept; the routes stay, so a client gets this answer rather
 * than a 404.
 *
 * @param table The ledger the row belongs to.
 * @param act What was refused (`update`, `delete`, `retire`, `restore`).
 * @returns The exception to throw.
 */
export function orderLedgerAppendOnly(table: string, act: string): BadRequestException {
	return new BadRequestException({
		message:
			`ORDER_LEDGER_APPEND_ONLY: ${table} is append-only and a row is never ${act}d; ` +
			`record the correction as a new row (an order change, or a MANUAL transaction).`,
		code: 'ORDER_LEDGER_APPEND_ONLY',
		details: { table, act }
	});
}
