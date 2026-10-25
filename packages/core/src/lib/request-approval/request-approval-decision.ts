import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ID, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';

/**
 * Who may answer a request approval, and what an answer does to it.
 *
 * `PUT /request-approval/approval/:id` and `PUT /request-approval/refuse/:id` (and their GraphQL twins
 * `approveRequestApproval` / `refuseRequestApproval`) used to set the request's status for anybody holding
 * `REQUEST_APPROVAL_EDIT`, which every employee holds by default: no approver check, no `min_count`, the
 * already-decided check commented out — and the handler then flipped the time-off request or the equipment
 * sharing the row is about. The rules below are what the two routes now apply.
 *
 * Approvers are modelled as slots on the request: one `request_approval_employee` row per approver employee and
 * one `request_approval_team` row per approver team, each with its own status. A caller answers:
 *
 * - **as a tenant administrator** (`SUPER_ADMIN` / `ADMIN`): the decision is final, whatever `min_count` says —
 *   the administrator's approve/refuse the Approvals page has always offered. A request already decided may be
 *   decided the other way (the page offers that too); the same decision twice is a conflict.
 * - **as a designated approver**: their own employee slot, and the slot of every approver team they are an active
 *   member of, record the answer. A refusal refuses the request outright, as the approver-aware writer always did;
 *   an approval approves the request once `min_count` approvers approved it (at least one — a zero count would
 *   stand approved before anybody had looked). A request already decided is a conflict.
 * - **as anybody else**: refused.
 *
 * Two rules keep an approval from counting for more than it is (owner decision Q9, 2026-10-24):
 *
 * - **One person counts once toward `min_count`.** `min_count` counts the people who approved, not the slots their
 *   approvals are recorded on: an approver who holds their own employee slot and is a member of an approver team
 *   records the approval on both slots, as before, and is counted once. Each slot remembers who answered it (its
 *   `updatedByUserId`, which the answer writes), and an approval recorded on a slot nobody is remembered against
 *   (a row older than the column, or written by another path) counts as one person of its own. The count never
 *   exceeds the number of approving slots either: a team slot is one approval, whichever members answer it.
 *   A team member whose team slot carries only a colleague's approval — the colleague counted through it and
 *   nowhere else — does not take it over, so the colleague's approval is not lost; a slot whose approver is
 *   counted through another slot too is taken over, so the second person counts.
 * - **Nobody approves a request they raised or that is for them, through any slot.** The person who raised the
 *   request (`createdByUserId`), and — for a request about a time-off request or an equipment sharing — the user
 *   who filed that document and the employees it is for, are not its approvers, even when listed by name or through
 *   an approver team they belong to. A tenant administrator still decides any request (the first rule above).
 *
 * Free of entity imports so it can be unit-tested on plain objects.
 */

/** The two decisions the routes carry. */
export type RequestApprovalVerdict = RequestApprovalStatusTypesEnum.APPROVED | RequestApprovalStatusTypesEnum.REFUSED;

/** An approver employee's slot on a request. */
export interface IEmployeeApproverSlot {
	id?: ID;
	employeeId: ID;
	status?: number | null;
	/** The user who last answered the slot: who an approval recorded on it counts for. */
	updatedByUserId?: ID | null;
}

/** An approver team's slot on a request. */
export interface ITeamApproverSlot {
	id?: ID;
	teamId: ID;
	status?: number | null;
	/** The user who last answered the slot: who an approval recorded on it counts for. */
	updatedByUserId?: ID | null;
}

/** The members of a request approval an answer reads and writes. */
export interface IAnswerableRequestApproval {
	status?: number | null;
	min_count?: number | null;
	createdByUserId?: ID | null;
	employeeApprovals?: IEmployeeApproverSlot[] | null;
	teamApprovals?: ITeamApproverSlot[] | null;
}

/**
 * Who a request is for besides the person who raised it: the user who filed the document it is about (a time-off
 * request, an equipment sharing) and the employees that document is for. None of them answers the request as an
 * approver.
 */
export interface IRequestApprovalRequestedFor {
	userIds?: ReadonlyArray<ID | null | undefined> | null;
	employeeIds?: ReadonlyArray<ID | null | undefined> | null;
}

/** The caller, as far as answering a request goes. */
export interface IRequestApprovalAnswerer {
	userId: ID | null;
	employeeId: ID | null;
	/** The request's approver teams the caller is an active member of. */
	teamIds: ID[];
	/** Whether the caller holds a tenant administrator role (`SUPER_ADMIN` / `ADMIN`). */
	isTenantAdmin: boolean;
}

/** What an answer did, so the caller can persist it and settle the document the request is about. */
export interface IRequestApprovalAnswerOutcome {
	/** The request's status before the answer. */
	previousStatus: number;
	/** The request's status after the answer. */
	status: number;
	/** True when the answer decided the request (or decided it the other way): the linked document moves. */
	settles: boolean;
	/** The employee slots the answer was recorded on. */
	employeeSlots: IEmployeeApproverSlot[];
	/** The team slots the answer was recorded on. */
	teamSlots: ITeamApproverSlot[];
}

/** The refusal a caller gets for a request they raised, or that is for them. */
export const REQUESTER_DOES_NOT_ANSWER =
	'The person who raised a request approval, or whom it is for, does not answer it.';

type ApproverSlot = IEmployeeApproverSlot | ITeamApproverSlot;

/**
 * Who an approval recorded on a slot counts for: the user remembered against the slot; else, on an employee slot,
 * its employee; else the slot itself (a person of its own, counted once).
 */
type Voter = string | ApproverSlot;

/**
 * @param status A request's status.
 * @returns Whether it is a final decision.
 */
export function isDecidedRequestApprovalStatus(status: number | null | undefined): boolean {
	return status === RequestApprovalStatusTypesEnum.APPROVED || status === RequestApprovalStatusTypesEnum.REFUSED;
}

/**
 * The number of approvers a request needs. A missing, zero, negative or non-numeric `min_count` means one.
 *
 * @param minCount The request's `min_count`.
 */
export function requiredApprovalCount(minCount: number | null | undefined): number {
	const count = Math.floor(Number(minCount));
	return Number.isFinite(count) && count >= 1 ? count : 1;
}

/**
 * Whether the caller raised the request, or is someone it is for.
 *
 * @param request The request.
 * @param answerer The caller.
 * @param requestedFor Who the document the request is about was filed by and is for, when it is about one.
 */
export function isRequesterOfRequestApproval(
	request: Pick<IAnswerableRequestApproval, 'createdByUserId'>,
	answerer: Pick<IRequestApprovalAnswerer, 'userId' | 'employeeId'>,
	requestedFor?: IRequestApprovalRequestedFor | null
): boolean {
	const userIds = [request.createdByUserId, ...(requestedFor?.userIds ?? [])].filter((id): id is ID => !!id);
	const employeeIds = (requestedFor?.employeeIds ?? []).filter((id): id is ID => !!id);

	return (
		(!!answerer.userId && userIds.includes(answerer.userId)) ||
		(!!answerer.employeeId && employeeIds.includes(answerer.employeeId))
	);
}

/**
 * Who an approval recorded on a slot counts for (see {@link Voter}).
 *
 * @param slot An approver slot.
 */
function voterOf(slot: ApproverSlot): Voter {
	if (slot.updatedByUserId) {
		return `user:${slot.updatedByUserId}`;
	}
	const employeeId = (slot as IEmployeeApproverSlot).employeeId;
	return employeeId ? `employee:${employeeId}` : slot;
}

/**
 * The number of people the approving slots count for: each approver once, however many slots they approved on.
 *
 * @param slots Every slot of the request.
 * @param voterOfSlot Who an approval on a slot counts for.
 */
function countApprovers(slots: ApproverSlot[], voterOfSlot: (slot: ApproverSlot) => Voter): number {
	const approvers = new Set<Voter>();
	for (const slot of slots) {
		if (slot.status === RequestApprovalStatusTypesEnum.APPROVED) {
			approvers.add(voterOfSlot(slot));
		}
	}
	return approvers.size;
}

/**
 * Records an answer on slots, in memory: the decision, and the user it counts for.
 *
 * @param slots The slots.
 * @param verdict The decision.
 * @param userId The answering user.
 */
function record(slots: ApproverSlot[], verdict: RequestApprovalVerdict, userId: ID | null): void {
	for (const slot of slots) {
		slot.status = verdict;
		if (userId) {
			slot.updatedByUserId = userId;
		}
	}
}

/**
 * The caller's slots an approval is recorded on: the slots still open, the caller's own employee slot, and the slots
 * already counted for the caller (or for nobody known). A slot that carries another person's approval is taken over
 * only when that person is counted through another slot as well, so taking it over loses nobody's approval.
 *
 * @param own The caller's slots, their own employee slot first.
 * @param all Every slot of the request.
 * @param self Who the caller's approval counts for.
 * @param isOwnEmployeeSlot Whether a slot is the caller's own employee slot.
 */
function slotsAnApprovalClaims(
	own: ApproverSlot[],
	all: ApproverSlot[],
	self: Voter,
	isOwnEmployeeSlot: (slot: ApproverSlot) => boolean
): Set<ApproverSlot> {
	// How many approving slots each approver is counted through now.
	const holdings = new Map<Voter, number>();
	for (const slot of all) {
		if (slot.status === RequestApprovalStatusTypesEnum.APPROVED) {
			const voter = voterOf(slot);
			holdings.set(voter, (holdings.get(voter) ?? 0) + 1);
		}
	}

	const claimed = new Set<ApproverSlot>();
	for (const slot of own) {
		if (slot.status !== RequestApprovalStatusTypesEnum.APPROVED) {
			claimed.add(slot);
			continue;
		}
		const voter = voterOf(slot);
		const held = holdings.get(voter) ?? 0;
		if (voter === self || typeof voter !== 'string' || isOwnEmployeeSlot(slot) || held > 1) {
			holdings.set(voter, held - 1);
			claimed.add(slot);
		}
	}
	return claimed;
}

/**
 * Applies one caller's answer to a request approval, in memory: the slots the answer is recorded on (each with the
 * caller as the user it counts for) and the request's own status are changed on the object passed in, and nothing
 * is written.
 *
 * @param request The request, with its employee and team slots loaded.
 * @param verdict The caller's decision.
 * @param answerer The caller.
 * @param requestedFor Who the document the request is about was filed by and is for, when it is about one; none of
 * them answers the request as an approver.
 * @returns What the answer did.
 * @throws BadRequestException for a decision that is neither approve nor refuse.
 * @throws ForbiddenException when the caller is neither a tenant administrator nor a designated approver, or raised
 * the request, or is someone it is for.
 * @throws ConflictException when the request already carries a final decision the caller may not change.
 */
export function answerRequestApproval(
	request: IAnswerableRequestApproval,
	verdict: RequestApprovalVerdict,
	answerer: IRequestApprovalAnswerer,
	requestedFor?: IRequestApprovalRequestedFor | null
): IRequestApprovalAnswerOutcome {
	if (verdict !== RequestApprovalStatusTypesEnum.APPROVED && verdict !== RequestApprovalStatusTypesEnum.REFUSED) {
		throw new BadRequestException('A request approval is answered by approving or refusing it.');
	}

	const previousStatus = request.status ?? RequestApprovalStatusTypesEnum.REQUESTED;
	const employeeApprovals = request.employeeApprovals ?? [];
	const teamApprovals = request.teamApprovals ?? [];

	// The requester is nobody's approver here: not through their own employee slot, and not through a team slot.
	const isRequester = isRequesterOfRequestApproval(request, answerer, requestedFor);
	const employeeSlots = answerer.employeeId
		? employeeApprovals.filter((slot) => slot.employeeId === answerer.employeeId)
		: [];
	const teamSlots = teamApprovals.filter((slot) => answerer.teamIds.includes(slot.teamId));
	const isApprover = !isRequester && employeeSlots.length + teamSlots.length > 0;

	if (answerer.isTenantAdmin) {
		if (previousStatus === verdict) {
			throw new ConflictException('The request approval already carries this decision.');
		}
		// An administrator's own slots, when they hold any, record the decision too, so the row reads consistently.
		const answeredEmployeeSlots = isApprover ? employeeSlots : [];
		const answeredTeamSlots = isApprover ? teamSlots : [];
		record([...answeredEmployeeSlots, ...answeredTeamSlots], verdict, answerer.userId);
		request.status = verdict;

		return {
			previousStatus,
			status: verdict,
			settles: true,
			employeeSlots: answeredEmployeeSlots,
			teamSlots: answeredTeamSlots
		};
	}

	if (!isApprover) {
		throw new ForbiddenException(
			isRequester
				? REQUESTER_DOES_NOT_ANSWER
				: 'Only a designated approver of this request approval, or a tenant administrator, may answer it.'
		);
	}

	if (isDecidedRequestApprovalStatus(previousStatus)) {
		throw new ConflictException('The request approval has already been decided.');
	}

	if (verdict === RequestApprovalStatusTypesEnum.REFUSED) {
		// A refusal refuses the request outright, recorded on every slot of the caller's.
		record([...employeeSlots, ...teamSlots], verdict, answerer.userId);
		request.status = RequestApprovalStatusTypesEnum.REFUSED;

		return {
			previousStatus,
			status: RequestApprovalStatusTypesEnum.REFUSED,
			settles: previousStatus !== RequestApprovalStatusTypesEnum.REFUSED,
			employeeSlots,
			teamSlots
		};
	}

	const allSlots: ApproverSlot[] = [...employeeApprovals, ...teamApprovals];
	const self: Voter = answerer.userId ? `user:${answerer.userId}` : `employee:${answerer.employeeId}`;
	const claimed = slotsAnApprovalClaims([...employeeSlots, ...teamSlots], allSlots, self, (slot) =>
		(employeeSlots as ApproverSlot[]).includes(slot)
	);
	const answeredEmployeeSlots = employeeSlots.filter((slot) => claimed.has(slot));
	const answeredTeamSlots = teamSlots.filter((slot) => claimed.has(slot));
	record([...answeredEmployeeSlots, ...answeredTeamSlots], verdict, answerer.userId);

	let status = previousStatus;
	const approvers = countApprovers(allSlots, (slot) => (claimed.has(slot) ? self : voterOf(slot)));
	if (approvers >= requiredApprovalCount(request.min_count)) {
		status = RequestApprovalStatusTypesEnum.APPROVED;
	}
	request.status = status;

	return {
		previousStatus,
		status,
		settles: status !== previousStatus && isDecidedRequestApprovalStatus(status),
		employeeSlots: answeredEmployeeSlots,
		teamSlots: answeredTeamSlots
	};
}
