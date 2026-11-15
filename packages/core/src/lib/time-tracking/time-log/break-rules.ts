import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as moment from 'moment';
import { IOrganization, ITimeLog, TimeLogType } from '@gauzy/contracts';

/** The code of the refusal of a break in an organization that does not allow breaks. */
export const BREAKS_NOT_ALLOWED = 'BREAKS_NOT_ALLOWED';

/** The code of the refusal of a break that would overlap another entry of the member. */
export const BREAK_OVERLAP = 'BREAK_OVERLAP';

/** The code of the refusal of an edit that would turn work into a break, or a break into work. */
export const BREAK_TYPE_LOCKED = 'BREAK_TYPE_LOCKED';

/**
 * Whether a time log, or the input of one, is a break: time away from work that never counts as worked, billable or
 * invoiced time.
 *
 * @param log The log, or its input.
 */
export function isBreak(log: Pick<ITimeLog, 'logType'> | null | undefined): boolean {
	return log?.logType === TimeLogType.BREAK;
}

/**
 * Refuses a break in an organization that does not allow breaks. The setting is off unless it is `true`: an
 * organization from before the setting, or one that never turned it on, refuses every break.
 *
 * @param organization The organization the break would be recorded in.
 * @throws ForbiddenException with the code BREAKS_NOT_ALLOWED.
 */
export function assertBreaksAllowedIn(organization: Pick<IOrganization, 'allowBreaks'> | null | undefined): void {
	const allowsBreaks = organization?.allowBreaks === true;
	if (!allowsBreaks) {
		throw new ForbiddenException({
			message: 'Breaks are turned off in this organization.',
			code: BREAKS_NOT_ALLOWED
		});
	}
}

/**
 * Refuses a break that overlaps another entry of the member. Manual work over existing time cuts the time it covers;
 * a break never does, since cutting work for a break would erase worked time.
 *
 * @param conflicts The member's entries the break's range overlaps.
 * @throws ConflictException with the code BREAK_OVERLAP.
 */
export function assertBreakOverlapsNothing(conflicts: ITimeLog[] | null | undefined): void {
	const overlapsAnEntry = (conflicts ?? []).length > 0;
	if (overlapsAnEntry) {
		throw new ConflictException({
			message: 'This break overlaps another entry. Choose a time outside it.',
			code: BREAK_OVERLAP
		});
	}
}

/**
 * Refuses work added or moved over a recorded break: the break is kept as recorded, never contradicted by an entry
 * the same person says they worked during it.
 *
 * @param conflicts The entries the new range overlaps.
 * @throws ConflictException with the code BREAK_OVERLAP when one of them is a break.
 */
export function assertWorkOverlapsNoBreak(conflicts: ITimeLog[] | null | undefined): void {
	const overlapsABreak = (conflicts ?? []).some((conflict) => isBreak(conflict));
	if (overlapsABreak) {
		throw new ConflictException({
			message: 'This entry overlaps a break. Choose a time outside it.',
			code: BREAK_OVERLAP
		});
	}
}

/**
 * Refuses an edit that changes whether an entry is a break: a break holds no time slots, and work keeps the slots it
 * tracked, so neither can become the other. An edit that does not name the type keeps it.
 *
 * @param stored The entry as it is stored.
 * @param requestedType The type the edit names, if any.
 * @throws ConflictException with the code BREAK_TYPE_LOCKED.
 */
export function assertBreakTypeKept(stored: Pick<ITimeLog, 'logType'>, requestedType: TimeLogType | undefined): void {
	if (requestedType === undefined || requestedType === null) {
		return;
	}
	const changesBreakState = isBreak(stored) !== (requestedType === TimeLogType.BREAK);
	if (changesBreakState) {
		throw new ConflictException({
			message: 'A break cannot become work, nor work a break. Delete the entry and add the right one.',
			code: BREAK_TYPE_LOCKED
		});
	}
}

/**
 * When a running break ends: at the start of the run that replaces it, when one is given (a start may be set earlier
 * than now), held between the break's own start and now. A run starting with or before the break replaces all of it,
 * so the break then ends at its own start.
 *
 * @param timeLog The running break.
 * @param replacedAt The start of the run that replaces it, if any.
 */
export function breakEnd(timeLog: Pick<ITimeLog, 'startedAt'>, replacedAt?: Date): Date {
	const now = moment.utc();
	if (!replacedAt) {
		return now.toDate();
	}
	const replaced = moment.utc(replacedAt);
	const breakStart = moment.utc(timeLog.startedAt);
	if (replaced.isSameOrBefore(breakStart)) {
		return breakStart.toDate();
	}
	if (replaced.isAfter(now)) {
		return now.toDate();
	}
	return replaced.toDate();
}
