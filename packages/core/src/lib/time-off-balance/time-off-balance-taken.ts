import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TimeOffBalance } from './time-off-balance.entity';

/** The refusal of a deduction the balance does not have the days for. */
export const INSUFFICIENT_LEAVE_BALANCE = 'Insufficient leave balance for the requested number of days';

/**
 * Which balance rows a taken-days statement may change: a parameterised SQL condition with double-quoted columns
 * (MySQL's backticks are put in for it).
 */
export interface ITimeOffBalanceRows {
	where: string;
	parameters: ObjectLiteral;
}

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

/**
 * Moves `days` between `remaining` and `taken` of the matching balance in ONE conditional UPDATE, so concurrent
 * approvals cannot lose an update: two read-modify-write pairs would each read the same `taken`, and one deduction
 * would vanish.
 *
 * Spending (`spending: true`) only matches a balance that has the days left; a zero count means "not enough" (or no
 * such balance). Giving days back clamps `taken` at zero, so a double reversal can never push it negative.
 *
 * @param source Where the statement is built: a transaction's manager to make it part of that transaction.
 * @param rows The balance rows the statement may change.
 * @param days How many days to move. Must be greater than zero.
 * @param spending Whether the days are taken (`true`) or given back (`false`).
 * @returns the number of rows the statement changed (0 or 1 for a single balance).
 * @throws BadRequestException when `days` is not greater than zero.
 */
export async function moveTakenDays(
	source: ITimeOffBalanceStatementSource,
	rows: ITimeOffBalanceRows,
	days: number,
	spending: boolean
): Promise<number> {
	if (!(days > 0)) {
		// A negative or zero delta would invert the arithmetic and hand out leave for free.
		throw new BadRequestException('The number of days must be greater than zero');
	}

	const takenExpression = spending
		? p(`"taken" + :days`)
		: p(`CASE WHEN "taken" - :days < 0 THEN 0 ELSE "taken" - :days END`);

	// Explicit, parameterised conditions rather than an object literal: an UPDATE builder's object form is easy to get
	// subtly wrong, and this leaves no doubt about what is scoped.
	const builder = source
		.createQueryBuilder()
		.update(TimeOffBalance)
		.set({
			// `remaining` goes first: MySQL evaluates single-table SET assignments left to right, so after `taken` it
			// would read the new `taken` and count the days twice.
			remaining: () => p(`"accrued" + "carriedForward" - (${takenExpression}) - "carriedOut"`),
			taken: () => takenExpression
		})
		.where(p(rows.where), rows.parameters)
		.setParameter('days', days);

	if (spending) {
		builder.andWhere(p(`"accrued" + "carriedForward" - "taken" - "carriedOut" >= :days`));
	}

	const result = await builder.execute();

	return result.affected ?? 0;
}
