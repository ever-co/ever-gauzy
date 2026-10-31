import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TimeOffBalance } from './time-off-balance.entity';

/** The refusal of a deduction the balance does not have the days for. */
export const INSUFFICIENT_LEAVE_BALANCE = 'Insufficient leave balance for the requested number of days';

/**
 * The refusal of an approval, under a policy that requires sufficient balance, that would take days of a year for
 * which an employee of the request has no balance allocated: there is no balance to cover them.
 *
 * @param years The years without a balance, in order.
 */
export function noLeaveBalanceAllocated(years: ReadonlyArray<number>): string {
	return (
		`Insufficient leave balance: no leave balance is allocated under this time-off policy for ${years.join(', ')}, ` +
		'and the policy requires sufficient balance to approve a request'
	);
}

/**
 * Which balance rows a taken-days statement may change: a parameterised SQL condition with double-quoted columns
 * (MySQL's backticks are put in for it).
 */
export interface ITimeOffBalanceRows {
	where: string;
	parameters: ObjectLiteral;
}

/**
 * How days move between `remaining` and `taken`:
 *
 * - `spend`: taken, but only when the balance has them left (`remaining >= days`); otherwise nothing changes;
 * - `overdraw`: taken whatever is left, so `remaining` may go below zero (an overdrawn balance);
 * - `giveBack`: given back, `taken` clamped at zero.
 */
export type TakenDaysMove = 'spend' | 'overdraw' | 'giveBack';

/**
 * Where a statement is built: the balance repository, or a transaction's entity manager so the statement is part of
 * that transaction.
 */
export interface ITimeOffBalanceStatementSource {
	createQueryBuilder(): SelectQueryBuilder<any>;
}

/**
 * The live balance with this id, in this tenant.
 *
 * @param id The balance.
 * @param tenantId The caller's tenant.
 */
export function balanceRowById(id: string, tenantId: string): ITimeOffBalanceRows {
	return {
		where: `"id" = :balanceId AND "tenantId" = :tenantId AND "deletedAt" IS NULL`,
		parameters: { balanceId: id, tenantId }
	};
}

/** The SQL of one move: see {@link takenDaysStatement}. */
export interface ITakenDaysStatement {
	/** What `taken` becomes. */
	taken: string;
	/** What `remaining` becomes, computed from the new `taken`. */
	remaining: string;
	/** For `spend` only: the condition that the balance has the days left; null otherwise. */
	daysLeft: string | null;
}

/**
 * The SQL of one move, with double-quoted columns (MySQL's backticks are put in) and `days` written wherever the
 * number of days goes: a named parameter for TypeORM's builder, a `?` for MikroORM's. Both ORMs' statements are built
 * from it, so the arithmetic exists once.
 *
 * `giveBack` clamps `taken` at zero, so a double reversal can never push it negative.
 *
 * @param move Whether the days are spent, spent even past what is left, or given back.
 * @param days The placeholder of the number of days.
 */
export function takenDaysStatement(move: TakenDaysMove, days: string): ITakenDaysStatement {
	const taken =
		move !== 'giveBack' ? `"taken" + ${days}` : `CASE WHEN "taken" - ${days} < 0 THEN 0 ELSE "taken" - ${days} END`;

	return {
		taken: p(taken),
		remaining: p(`"accrued" + "carriedForward" - (${taken}) - "carriedOut"`),
		daysLeft: move === 'spend' ? p(`"accrued" + "carriedForward" - "taken" - "carriedOut" >= ${days}`) : null
	};
}

/**
 * Refuses a number of days that is not greater than zero: a negative or zero delta would invert the arithmetic of a
 * move and hand out leave for free.
 *
 * @param days How many days a move is asked to move.
 * @throws BadRequestException when `days` is not greater than zero.
 */
export function assertDaysToMove(days: number): void {
	if (!(days > 0)) {
		throw new BadRequestException('The number of days must be greater than zero');
	}
}

/**
 * Moves `days` between `remaining` and `taken` of the matching balance in ONE conditional UPDATE, so concurrent
 * approvals cannot lose an update: two read-modify-write pairs would each read the same `taken`, and one deduction
 * would vanish.
 *
 * `spend` only matches a balance that has the days left; a zero count means "not enough" (or no such balance).
 * `overdraw` matches the balance whatever is left; a zero count means no such balance. `giveBack` clamps `taken` at
 * zero, so a double reversal can never push it negative.
 *
 * @param source Where the statement is built: a transaction's manager to make it part of that transaction.
 * @param rows The balance rows the statement may change.
 * @param days How many days to move. Must be greater than zero.
 * @param move Whether the days are spent, spent even past what is left, or given back.
 * @returns the number of rows the statement changed (0 or 1 for a single balance).
 * @throws BadRequestException when `days` is not greater than zero.
 */
export async function moveTakenDays(
	source: ITimeOffBalanceStatementSource,
	rows: ITimeOffBalanceRows,
	days: number,
	move: TakenDaysMove
): Promise<number> {
	assertDaysToMove(days);

	const statement = takenDaysStatement(move, ':days');

	// Explicit, parameterised conditions rather than an object literal: an UPDATE builder's object form is easy to get
	// subtly wrong, and this leaves no doubt about what is scoped.
	const builder = source
		.createQueryBuilder()
		.update(TimeOffBalance)
		.set({
			// `remaining` goes first: MySQL evaluates single-table SET assignments left to right, so after `taken` it
			// would read the new `taken` and count the days twice.
			remaining: () => statement.remaining,
			taken: () => statement.taken
		})
		.where(p(rows.where), rows.parameters)
		.setParameter('days', days);

	if (statement.daysLeft) {
		builder.andWhere(statement.daysLeft);
	}

	const result = await builder.execute();

	return result.affected ?? 0;
}
