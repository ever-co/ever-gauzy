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
 *   an approval approves the request once the approving slots reach `min_count` (at least one — a zero count would
 *   stand approved before anybody had looked). A request already decided is a conflict. The person who raised the
 *   request is not its approver, even when listed.
 * - **as anybody else**: refused.
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
}

/** An approver team's slot on a request. */
export interface ITeamApproverSlot {
	id?: ID;
	teamId: ID;
	status?: number | null;
}

/** The members of a request approval an answer reads and writes. */
export interface IAnswerableRequestApproval {
	status?: number | null;
	min_count?: number | null;
	createdByUserId?: ID | null;
	employeeApprovals?: IEmployeeApproverSlot[] | null;
	teamApprovals?: ITeamApproverSlot[] | null;
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

/**
 * @param status A request's status.
 * @returns Whether it is a final decision.
 */
export function isDecidedRequestApprovalStatus(status: number | null | undefined): boolean {
	return status === RequestApprovalStatusTypesEnum.APPROVED || status === RequestApprovalStatusTypesEnum.REFUSED;
}

/**
 * The number of approving slots a request needs. A missing, zero, negative or non-numeric `min_count` means one.
 *
 * @param minCount The request's `min_count`.
 */
export function requiredApprovalCount(minCount: number | null | undefined): number {
	const count = Math.floor(Number(minCount));
	return Number.isFinite(count) && count >= 1 ? count : 1;
}

/**
 * Applies one caller's answer to a request approval, in memory: the slots the answer is recorded on and the
 * request's own status are changed on the object passed in, and nothing is written.
 *
 * @param request The request, with its employee and team slots loaded.
 * @param verdict The caller's decision.
 * @param answerer The caller.
 * @returns What the answer did.
 * @throws BadRequestException for a decision that is neither approve nor refuse.
 * @throws ForbiddenException when the caller is neither a tenant administrator nor a designated approver.
 * @throws ConflictException when the request already carries a final decision the caller may not change.
 */
export function answerRequestApproval(
	request: IAnswerableRequestApproval,
	verdict: RequestApprovalVerdict,
	answerer: IRequestApprovalAnswerer
): IRequestApprovalAnswerOutcome {
	if (verdict !== RequestApprovalStatusTypesEnum.APPROVED && verdict !== RequestApprovalStatusTypesEnum.REFUSED) {
		throw new BadRequestException('A request approval is answered by approving or refusing it.');
	}

	const previousStatus = request.status ?? RequestApprovalStatusTypesEnum.REQUESTED;
	const employeeApprovals = request.employeeApprovals ?? [];
	const teamApprovals = request.teamApprovals ?? [];

	const isRequester = !!answerer.userId && request.createdByUserId === answerer.userId;
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
		[...answeredEmployeeSlots, ...answeredTeamSlots].forEach((slot) => (slot.status = verdict));
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
				? 'The person who raised a request approval does not answer it.'
				: 'Only a designated approver of this request approval, or a tenant administrator, may answer it.'
		);
	}

	if (isDecidedRequestApprovalStatus(previousStatus)) {
		throw new ConflictException('The request approval has already been decided.');
	}

	[...employeeSlots, ...teamSlots].forEach((slot) => (slot.status = verdict));

	let status = previousStatus;
	if (verdict === RequestApprovalStatusTypesEnum.REFUSED) {
		status = RequestApprovalStatusTypesEnum.REFUSED;
	} else {
		const approving = [...employeeApprovals, ...teamApprovals].filter(
			(slot) => slot.status === RequestApprovalStatusTypesEnum.APPROVED
		).length;
		if (approving >= requiredApprovalCount(request.min_count)) {
			status = RequestApprovalStatusTypesEnum.APPROVED;
		}
	}
	request.status = status;

	return {
		previousStatus,
		status,
		settles: status !== previousStatus && isDecidedRequestApprovalStatus(status),
		employeeSlots,
		teamSlots
	};
}
