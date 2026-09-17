import { EntitlementKind, EntitlementStatus } from '../entitlement.enums';
import { EntitlementCheckReason, EntitlementCheckReasonValue } from '../entitlement.types';

/**
 * The part of an entitlement the verdict is derived from.
 *
 * Stated as the narrowest shape that answers the question rather than as the entity, so the same
 * function decides the check endpoint, the activation path and the guard, and a unit test needs no
 * database to exercise it.
 */
export interface IEntitlementState {
	readonly status: EntitlementStatus;
	readonly kind: EntitlementKind;
	/** Seats, uses or `1`; `0` means unlimited. */
	readonly quantity: number;
	/** Simultaneous-activation ceiling, when it is tighter than `quantity`. */
	readonly activationLimit?: number | null;
	/** The cached live activation count. */
	readonly activationCount: number;
	readonly startsAt: Date;
	readonly endsAt?: Date | null;
	readonly gracePeriodDays: number;
}

/** What the caller counted, as opposed to what the entitlement caches. */
export interface IEntitlementOccupancy {
	/** Activation rows in `ACTIVE`, counted at the moment of the question. */
	readonly liveActivations: number;
}

/** A verdict, with the code that explains it. */
export interface IEntitlementVerdict {
	readonly allowed: boolean;
	readonly reason: EntitlementCheckReasonValue;
}

/**
 * @param entitlement The entitlement.
 * @param at The instant the question is asked at.
 * @returns The instant the right stops being exercisable once its grace period has run; null when
 * the right is perpetual, which is expressed by `endsAt` being null rather than by a flag.
 */
export function entitlementTermEnd(entitlement: IEntitlementState, at: Date = new Date()): Date | null {
	if (!entitlement.endsAt) {
		return null;
	}

	const endsAt = new Date(entitlement.endsAt);
	const graceDays = Number.isFinite(Number(entitlement.gracePeriodDays)) ? Number(entitlement.gracePeriodDays) : 0;

	// The grace period extends when the right stops being exercisable, never when it was granted: a
	// renewal chased during the window resumes the same row rather than issuing a new one.
	return new Date(endsAt.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

/**
 * @param entitlement The entitlement.
 * @param at The instant the question is asked at.
 * @returns Whether the term has opened.
 */
export function isWithinTermStart(entitlement: IEntitlementState, at: Date = new Date()): boolean {
	if (!entitlement.startsAt) {
		return true;
	}

	return new Date(entitlement.startsAt).getTime() <= at.getTime();
}

/**
 * @param entitlement The entitlement.
 * @param at The instant the question is asked at.
 * @returns Whether the term has not yet run out, grace included. A perpetual right never runs out.
 */
export function isWithinTermEnd(entitlement: IEntitlementState, at: Date = new Date()): boolean {
	const end = entitlementTermEnd(entitlement, at);

	return end === null || end.getTime() >= at.getTime();
}

/**
 * @param entitlement The entitlement.
 * @param occupancy What the caller counted.
 * @returns Seats or uses still available, or null when the right is unlimited.
 */
export function remainingQuantity(
	entitlement: IEntitlementState,
	occupancy: IEntitlementOccupancy
): number | null {
	if (Number(entitlement.quantity) === 0) {
		return null;
	}

	const live = Number.isFinite(occupancy.liveActivations) ? occupancy.liveActivations : 0;

	// A count above the ceiling is reported as zero rather than as a negative: the audit repairs the
	// over-count, and a negative "remaining" would read as a credit the customer does not have.
	return Math.max(0, Number(entitlement.quantity) - live);
}

/**
 * Derives the verdict for one entitlement.
 *
 * The order of the questions is the order they are asked in, because each one is cheaper to answer
 * than the next and because the first failing answer is the one a caller has to act on: a revoked
 * right is revoked whatever its dates say, and a right whose term has not opened is not a seat
 * problem.
 *
 * @param entitlement The entitlement.
 * @param occupancy What the caller counted.
 * @param at The instant the question is asked at.
 * @returns Whether the right may be exercised, and the code that explains it.
 */
export function evaluateEntitlementState(
	entitlement: IEntitlementState,
	occupancy: IEntitlementOccupancy,
	at: Date = new Date()
): IEntitlementVerdict {
	if (entitlement.status === EntitlementStatus.REVOKED) {
		return { allowed: false, reason: EntitlementCheckReason.REVOKED };
	}

	if (entitlement.status === EntitlementStatus.SUSPENDED) {
		return { allowed: false, reason: EntitlementCheckReason.SUSPENDED };
	}

	if (entitlement.status === EntitlementStatus.PENDING) {
		return { allowed: false, reason: EntitlementCheckReason.PENDING };
	}

	if (entitlement.status === EntitlementStatus.EXPIRED) {
		return { allowed: false, reason: EntitlementCheckReason.EXPIRED };
	}

	if (!isWithinTermStart(entitlement, at)) {
		return { allowed: false, reason: EntitlementCheckReason.TERM_NOT_STARTED };
	}

	if (!isWithinTermEnd(entitlement, at)) {
		return { allowed: false, reason: EntitlementCheckReason.EXPIRED };
	}

	// The activation ceiling is answered from the cache, because it is a stored ceiling on stored
	// activity; the seat ceiling is answered from a count, because it is a fact about rows the audit
	// can re-derive. Reading each from where it is authoritative is what keeps the two answers equal.
	const activationLimit = entitlement.activationLimit;
	if (activationLimit !== null && activationLimit !== undefined && Number(entitlement.activationCount) >= Number(activationLimit)) {
		return { allowed: false, reason: EntitlementCheckReason.ACTIVATION_LIMIT_REACHED };
	}

	if (remainingQuantity(entitlement, occupancy) === 0) {
		return { allowed: false, reason: EntitlementCheckReason.QUANTITY_EXHAUSTED };
	}

	return { allowed: true, reason: EntitlementCheckReason.ALLOWED };
}

/**
 * @param entitlement The entitlement.
 * @param at The instant the sweep is asked at.
 * @returns Whether the right is past its term and its grace period, which is what the expiry pass
 * expires. A revoked right is never expired — revocation is terminal and stays in the history.
 */
export function isDueForExpiry(entitlement: IEntitlementState, at: Date = new Date()): boolean {
	if (entitlement.status === EntitlementStatus.REVOKED || entitlement.status === EntitlementStatus.EXPIRED) {
		return false;
	}

	const end = entitlementTermEnd(entitlement, at);

	return end !== null && end.getTime() < at.getTime();
}

/**
 * @param value The value a caller stated.
 * @returns The value as a whole non-negative number, or null when it stated none.
 * @throws Error when the value is not a whole non-negative number, because a fractional seat count is
 * a caller mistake and silently truncating it would grant a different right than the one asked for.
 */
export function toWholeQuantity(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined || String(value) === '') {
		return null;
	}

	const parsed = Number(value);

	if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`QUANTITY_INVALID: ${value} is not a whole non-negative number.`);
	}

	return parsed;
}
