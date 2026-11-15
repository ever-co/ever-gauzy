import { ISavedReport, ISavedReportCreateInput } from '@gauzy/contracts';
import { fixedDaysCount, SAVED_REPORT_MAX_FIXED_DAYS } from './saved-report-period';

/** The fields that state a saved report's period. */
export type SavedReportPeriodFields = Pick<ISavedReport, 'periodRule' | 'startDate' | 'endDate'>;

/**
 * What is wrong with a period, in words a client can show; null when it is a rule alone, or two real days in order
 * covering at most {@link SAVED_REPORT_MAX_FIXED_DAYS} days.
 *
 * @param period The rule or the days.
 */
export function savedReportPeriodProblemOf(period: SavedReportPeriodFields): string | null {
	const hasRule = !!period.periodRule;
	const hasStart = !!period.startDate;
	const hasEnd = !!period.endDate;
	const hasAnyDay = hasStart || hasEnd;
	const hasBothDays = hasStart && hasEnd;
	if (hasRule && hasAnyDay) {
		return 'State the period as a rule or as two days, not both.';
	}
	if (hasRule) {
		return null;
	}
	if (!hasBothDays) {
		return 'State the period as a rule, or as a first and a last day.';
	}
	const days = fixedDaysCount(period.startDate, period.endDate);
	if (days === null) {
		return 'The last day must be a real day, on or after the first day.';
	}
	if (days > SAVED_REPORT_MAX_FIXED_DAYS) {
		return `Fixed dates cover at most ${SAVED_REPORT_MAX_FIXED_DAYS} days.`;
	}
	return null;
}

/**
 * The period an update leaves on a report: each field the update sends (null included, which clears it) replaces the
 * stored one, the others are kept.
 *
 * @param stored The report as stored.
 * @param input The update.
 */
export function nextSavedReportPeriodOf(
	stored: SavedReportPeriodFields,
	input: Partial<Pick<ISavedReportCreateInput, 'periodRule' | 'startDate' | 'endDate'>>
): SavedReportPeriodFields {
	const next: SavedReportPeriodFields = {
		periodRule: stored.periodRule ?? null,
		startDate: stored.startDate ?? null,
		endDate: stored.endDate ?? null
	};
	if (input.periodRule !== undefined) {
		next.periodRule = input.periodRule;
	}
	if (input.startDate !== undefined) {
		next.startDate = input.startDate;
	}
	if (input.endDate !== undefined) {
		next.endDate = input.endDate;
	}
	return next;
}

/**
 * Whether a report's link works at `now`: it is on and its end, if any, is still ahead.
 *
 * @param report The stored link state.
 * @param now The moment of the check.
 */
export function isSavedReportLinkLive(
	report: Pick<ISavedReport, 'shareExpiresAt'> & { shareTokenHash?: string | null },
	now: Date
): boolean {
	if (!report.shareTokenHash) {
		return false;
	}
	if (!report.shareExpiresAt) {
		return true;
	}
	return new Date(report.shareExpiresAt).getTime() > now.getTime();
}

/**
 * What is wrong with a link's end date; null when there is none or it is ahead of `now`.
 *
 * @param expiresAt The end date sent.
 * @param now The moment the link is turned on.
 */
export function shareExpiryProblemOf(expiresAt: string | Date | null | undefined, now: Date): string | null {
	if (expiresAt === undefined || expiresAt === null) {
		return null;
	}
	const end = new Date(expiresAt);
	if (Number.isNaN(end.getTime())) {
		return 'The end date of the link is not a date.';
	}
	if (end.getTime() <= now.getTime()) {
		return 'The end date of the link must be in the future.';
	}
	return null;
}
