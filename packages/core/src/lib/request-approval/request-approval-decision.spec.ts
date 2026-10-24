import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import {
	answerRequestApproval,
	IAnswerableRequestApproval,
	IRequestApprovalAnswerer,
	requiredApprovalCount
} from './request-approval-decision';

/**
 * F1 (privilege-escalation audit 2026-10-24): `PUT /request-approval/{approval,refuse}/:id` set a request's status
 * for any `REQUEST_APPROVAL_EDIT` holder — every employee — with no approver check and no `min_count`, and its
 * already-decided check commented out. These are the rules the routes now apply, on plain objects.
 */

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const REQUESTER = 'user-requester';
const ALICE = { userId: 'user-alice', employeeId: 'employee-alice' };
const BOB = { userId: 'user-bob', employeeId: 'employee-bob' };
const MALLORY = { userId: 'user-mallory', employeeId: 'employee-mallory' };
const FINANCE = 'team-finance';

function request(overrides: Partial<IAnswerableRequestApproval> = {}): IAnswerableRequestApproval {
	return {
		status: REQUESTED,
		min_count: 1,
		createdByUserId: REQUESTER,
		employeeApprovals: [
			{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED },
			{ id: 'slot-bob', employeeId: BOB.employeeId, status: REQUESTED }
		],
		teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED }],
		...overrides
	};
}

function as(
	who: { userId: string; employeeId: string | null },
	extra: Partial<IRequestApprovalAnswerer> = {}
): IRequestApprovalAnswerer {
	return { userId: who.userId, employeeId: who.employeeId, teamIds: [], isTenantAdmin: false, ...extra };
}

describe('answerRequestApproval — who may answer', () => {
	it('refuses an employee who is not an approver of the request (the audit exploit)', () => {
		const row = request();

		expect(() => answerRequestApproval(row, APPROVED, as(MALLORY))).toThrow(ForbiddenException);
		expect(() => answerRequestApproval(row, REFUSED, as(MALLORY))).toThrow(ForbiddenException);
		// Nothing moved.
		expect(row.status).toBe(REQUESTED);
		expect(row.employeeApprovals.map((slot) => slot.status)).toEqual([REQUESTED, REQUESTED]);
	});

	it('refuses a caller with no employee and no administrator role', () => {
		expect(() => answerRequestApproval(request(), APPROVED, as({ userId: 'user-x', employeeId: null }))).toThrow(
			ForbiddenException
		);
	});

	it('refuses the person who raised the request, even when they listed themselves', () => {
		const row = request({
			createdByUserId: MALLORY.userId,
			employeeApprovals: [{ id: 'slot-mallory', employeeId: MALLORY.employeeId, status: REQUESTED }]
		});

		expect(() => answerRequestApproval(row, APPROVED, as(MALLORY))).toThrow(ForbiddenException);
		expect(row.status).toBe(REQUESTED);
	});

	it('lets a listed approver employee answer', () => {
		const row = request();

		const outcome = answerRequestApproval(row, APPROVED, as(ALICE));

		expect(outcome.employeeSlots.map((slot) => slot.id)).toEqual(['slot-alice']);
		expect(row.employeeApprovals.find((slot) => slot.id === 'slot-alice').status).toBe(APPROVED);
		expect(row.employeeApprovals.find((slot) => slot.id === 'slot-bob').status).toBe(REQUESTED);
	});

	it('lets an active member of an approver team answer for the team', () => {
		const row = request();

		const outcome = answerRequestApproval(row, APPROVED, as(MALLORY, { teamIds: [FINANCE] }));

		expect(outcome.teamSlots.map((slot) => slot.id)).toEqual(['slot-finance']);
		expect(row.teamApprovals[0].status).toBe(APPROVED);
		expect(outcome.status).toBe(APPROVED);
	});

	it('does not treat membership of a team that is not an approver team as a slot', () => {
		expect(() => answerRequestApproval(request(), APPROVED, as(MALLORY, { teamIds: ['team-other'] }))).toThrow(
			ForbiddenException
		);
	});
});

describe('answerRequestApproval — min_count', () => {
	it('keeps the request waiting until enough approvers approved, then approves it', () => {
		const row = request({ min_count: 2 });

		const first = answerRequestApproval(row, APPROVED, as(ALICE));
		expect(first.status).toBe(REQUESTED);
		expect(first.settles).toBe(false);
		expect(row.status).toBe(REQUESTED);

		const second = answerRequestApproval(row, APPROVED, as(BOB));
		expect(second.status).toBe(APPROVED);
		expect(second.settles).toBe(true);
		expect(row.status).toBe(APPROVED);
	});

	it('counts an approver team as one approving slot', () => {
		const row = request({ min_count: 2 });

		expect(answerRequestApproval(row, APPROVED, as(MALLORY, { teamIds: [FINANCE] })).settles).toBe(false);
		expect(answerRequestApproval(row, APPROVED, as(BOB)).settles).toBe(true);
	});

	it('never approves on fewer approvals than the request asks for', () => {
		const row = request({ min_count: 3 });

		answerRequestApproval(row, APPROVED, as(ALICE));
		answerRequestApproval(row, APPROVED, as(BOB));

		expect(row.status).toBe(REQUESTED);
	});

	it('refuses the request on one approver refusal', () => {
		const row = request({ min_count: 2 });

		const outcome = answerRequestApproval(row, REFUSED, as(ALICE));

		expect(outcome.status).toBe(REFUSED);
		expect(outcome.settles).toBe(true);
	});

	it.each([
		[undefined, 1],
		[null, 1],
		[0, 1],
		[-2, 1],
		[Number.NaN, 1],
		[2, 2],
		[2.7, 2]
	])('reads min_count %p as %p', (minCount, required) => {
		expect(requiredApprovalCount(minCount as number)).toBe(required);
	});

	it('does not stand approved on a zero min_count before anybody approved', () => {
		const row = request({ min_count: 0 });

		// One approval is still needed: the request waits for Alice's, it is not approved by being filed.
		const outcome = answerRequestApproval(row, APPROVED, as(ALICE));

		expect(outcome.previousStatus).toBe(REQUESTED);
		expect(outcome.status).toBe(APPROVED);
	});
});

describe('answerRequestApproval — conflicts', () => {
	it.each([APPROVED, REFUSED])('refuses an approver answering a request already decided (%p)', (decided) => {
		const row = request({ status: decided });

		expect(() => answerRequestApproval(row, APPROVED, as(ALICE))).toThrow(ConflictException);
		expect(() => answerRequestApproval(row, REFUSED, as(ALICE))).toThrow(ConflictException);
		expect(row.status).toBe(decided);
	});

	it('treats a request with no stored status as waiting', () => {
		const row = request({ status: null });

		expect(answerRequestApproval(row, APPROVED, as(ALICE)).status).toBe(APPROVED);
	});
});

describe('answerRequestApproval — tenant administrator', () => {
	const ADMIN = { userId: 'user-admin', employeeId: null };

	it('decides outright, whatever min_count says', () => {
		const row = request({ min_count: 5 });

		const outcome = answerRequestApproval(row, APPROVED, as(ADMIN, { isTenantAdmin: true }));

		expect(outcome).toEqual(expect.objectContaining({ status: APPROVED, settles: true }));
		expect(row.status).toBe(APPROVED);
		// An administrator who holds no slot records none.
		expect(outcome.employeeSlots).toEqual([]);
	});

	it('may decide a decided request the other way, as the Approvals page offers', () => {
		const row = request({ status: APPROVED });

		expect(answerRequestApproval(row, REFUSED, as(ADMIN, { isTenantAdmin: true })).status).toBe(REFUSED);
	});

	it('gets a conflict for the decision the request already carries', () => {
		expect(() =>
			answerRequestApproval(request({ status: APPROVED }), APPROVED, as(ADMIN, { isTenantAdmin: true }))
		).toThrow(ConflictException);
	});

	it('decides a request they raised themselves', () => {
		const row = request({ createdByUserId: ADMIN.userId });

		expect(answerRequestApproval(row, APPROVED, as(ADMIN, { isTenantAdmin: true })).status).toBe(APPROVED);
	});
});
