import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import {
	answerRequestApproval,
	IAnswerableRequestApproval,
	IRequestApprovalAnswerer,
	isRequesterOfRequestApproval,
	REQUESTER_DOES_NOT_ANSWER,
	RequestApprovalVerdict,
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

/**
 * Owner decision Q9 (2026-10-24): today's rules stand — an administrator overrides `min_count` and may re-decide a
 * decided request, a requester does not approve their own request — and self-approval is tightened: one person never
 * counts more than once toward `min_count`, and the requester answers through no slot at all.
 */
describe('answerRequestApproval — one person counts once toward min_count', () => {
	const LEGAL = 'team-legal';
	const CAROL = { userId: 'user-carol', employeeId: 'employee-carol' };
	const ADMIN = { userId: 'user-admin', employeeId: null };

	/** Alice's own slot and the finance team's slot: Alice, a finance member, holds both. */
	function aliceAndFinance(overrides: Partial<IAnswerableRequestApproval> = {}): IAnswerableRequestApproval {
		return request({
			min_count: 2,
			employeeApprovals: [{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }],
			teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED }],
			...overrides
		});
	}

	it('records an approver holding their own slot and a team slot on both, and counts them once', () => {
		const row = aliceAndFinance();

		const outcome = answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));

		// Both slots read approved, as before; the request still waits for a second person.
		expect(outcome.employeeSlots.map((slot) => slot.id)).toEqual(['slot-alice']);
		expect(outcome.teamSlots.map((slot) => slot.id)).toEqual(['slot-finance']);
		expect(row.employeeApprovals[0].status).toBe(APPROVED);
		expect(row.teamApprovals[0].status).toBe(APPROVED);
		expect(outcome.status).toBe(REQUESTED);
		expect(outcome.settles).toBe(false);
		expect(row.status).toBe(REQUESTED);
	});

	it('records the answering user on every slot the answer writes', () => {
		const row = aliceAndFinance();

		const outcome = answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));

		expect([...outcome.employeeSlots, ...outcome.teamSlots].map((slot) => slot.updatedByUserId)).toEqual([
			ALICE.userId,
			ALICE.userId
		]);
	});

	it('does not count a second answer of the same person', () => {
		const row = aliceAndFinance();

		answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));
		const again = answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));

		expect(again.status).toBe(REQUESTED);
		expect(row.status).toBe(REQUESTED);
	});

	it('counts a member of two approver teams once', () => {
		const row = request({
			min_count: 2,
			employeeApprovals: [],
			teamApprovals: [
				{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED },
				{ id: 'slot-legal', teamId: LEGAL, status: REQUESTED }
			]
		});

		const outcome = answerRequestApproval(row, APPROVED, as(CAROL, { teamIds: [FINANCE, LEGAL] }));

		expect(outcome.teamSlots.map((slot) => slot.id)).toEqual(['slot-finance', 'slot-legal']);
		expect(outcome.status).toBe(REQUESTED);
	});

	it('approves once a second person approves', () => {
		const row = aliceAndFinance({
			employeeApprovals: [
				{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED },
				{ id: 'slot-bob', employeeId: BOB.employeeId, status: REQUESTED }
			]
		});

		answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));
		const second = answerRequestApproval(row, APPROVED, as(BOB));

		expect(second.status).toBe(APPROVED);
		expect(second.settles).toBe(true);
	});

	it('lets a team colleague take over the team slot of an approver counted through their own slot too', () => {
		const row = aliceAndFinance();
		answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));

		// Mallory answers for finance: Alice still counts through her own slot, so Mallory counts as the second person.
		const outcome = answerRequestApproval(row, APPROVED, as(MALLORY, { teamIds: [FINANCE] }));

		expect(outcome.teamSlots.map((slot) => slot.id)).toEqual(['slot-finance']);
		expect(row.teamApprovals[0].updatedByUserId).toBe(MALLORY.userId);
		expect(outcome.status).toBe(APPROVED);
	});

	it('keeps the approval of a colleague counted through the team slot alone, and counts both people', () => {
		const row = aliceAndFinance();
		answerRequestApproval(row, APPROVED, as(MALLORY, { teamIds: [FINANCE] }));

		// Alice's own slot records her approval; the finance slot stays Mallory's, who counts through it alone.
		const outcome = answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }));

		expect(outcome.employeeSlots.map((slot) => slot.id)).toEqual(['slot-alice']);
		expect(outcome.teamSlots).toEqual([]);
		expect(row.teamApprovals[0].updatedByUserId).toBe(MALLORY.userId);
		expect(outcome.status).toBe(APPROVED);
	});

	it('records nothing for a team member whose only slot carries the sole approval of a colleague', () => {
		const row = request({
			min_count: 2,
			employeeApprovals: [{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }],
			teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: APPROVED, updatedByUserId: MALLORY.userId }]
		});

		const outcome = answerRequestApproval(row, APPROVED, as(CAROL, { teamIds: [FINANCE] }));

		// The team's one approval is Mallory's: Carol's adds no second approval, and nothing is taken from Mallory.
		expect(outcome.employeeSlots).toEqual([]);
		expect(outcome.teamSlots).toEqual([]);
		expect(row.teamApprovals[0].updatedByUserId).toBe(MALLORY.userId);
		expect(outcome.status).toBe(REQUESTED);
	});

	it('counts slots answered earlier by the same user once', () => {
		const answeredByAlice = (minCount: number) =>
			aliceAndFinance({
				min_count: minCount,
				employeeApprovals: [
					{ id: 'slot-alice', employeeId: ALICE.employeeId, status: APPROVED, updatedByUserId: ALICE.userId },
					{ id: 'slot-bob', employeeId: BOB.employeeId, status: REQUESTED }
				],
				teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: APPROVED, updatedByUserId: ALICE.userId }]
			});

		expect(answerRequestApproval(answeredByAlice(2), APPROVED, as(BOB)).status).toBe(APPROVED);
		expect(answerRequestApproval(answeredByAlice(3), APPROVED, as(BOB)).status).toBe(REQUESTED);
	});

	it('counts an approval on a slot nobody is remembered against as one person of its own', () => {
		const row = aliceAndFinance({
			employeeApprovals: [{ id: 'slot-bob', employeeId: BOB.employeeId, status: REQUESTED }],
			teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: APPROVED }]
		});

		expect(answerRequestApproval(row, APPROVED, as(BOB)).status).toBe(APPROVED);
	});

	it('records a refusal on every slot of the caller, and refuses the request outright', () => {
		const row = aliceAndFinance();

		const outcome = answerRequestApproval(row, REFUSED, as(ALICE, { teamIds: [FINANCE] }));

		expect(outcome.employeeSlots.map((slot) => slot.status)).toEqual([REFUSED]);
		expect(outcome.teamSlots.map((slot) => slot.status)).toEqual([REFUSED]);
		expect(outcome.status).toBe(REFUSED);
		expect(outcome.settles).toBe(true);
	});

	it('still lets a tenant administrator decide outright, whatever min_count and the slots say', () => {
		const row = aliceAndFinance({ min_count: 5 });

		const outcome = answerRequestApproval(row, APPROVED, as(ADMIN, { isTenantAdmin: true }));

		expect(outcome.status).toBe(APPROVED);
		expect(outcome.settles).toBe(true);
	});
});

describe('answerRequestApproval — the requester answers through no slot', () => {
	/** Mallory holds her own slot and is a finance member. */
	const malloryListed = (overrides: Partial<IAnswerableRequestApproval> = {}) =>
		request({
			employeeApprovals: [{ id: 'slot-mallory', employeeId: MALLORY.employeeId, status: REQUESTED }],
			teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED }],
			...overrides
		});
	const financeOnly = () =>
		request({
			employeeApprovals: [],
			teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED }]
		});

	it.each<RequestApprovalVerdict>([APPROVED, REFUSED])(
		'refuses the person who raised the request answering (%p) through an approver team they belong to',
		(verdict) => {
			const row = { ...financeOnly(), createdByUserId: MALLORY.userId };

			expect(() => answerRequestApproval(row, verdict, as(MALLORY, { teamIds: [FINANCE] }))).toThrow(
				ForbiddenException
			);
			expect(row.status).toBe(REQUESTED);
			expect(row.teamApprovals[0].status).toBe(REQUESTED);
		}
	);

	it('refuses the requester holding their own slot and a team slot, and records nothing on either', () => {
		const row = malloryListed({ createdByUserId: MALLORY.userId });

		expect(() => answerRequestApproval(row, APPROVED, as(MALLORY, { teamIds: [FINANCE] }))).toThrow(
			REQUESTER_DOES_NOT_ANSWER
		);
		expect(row.employeeApprovals[0].status).toBe(REQUESTED);
		expect(row.teamApprovals[0].status).toBe(REQUESTED);
	});

	it('refuses the user who filed the document the request is about, through a team slot', () => {
		const row = financeOnly();

		expect(() =>
			answerRequestApproval(row, APPROVED, as(MALLORY, { teamIds: [FINANCE] }), { userIds: [MALLORY.userId] })
		).toThrow(ForbiddenException);
		expect(row.status).toBe(REQUESTED);
	});

	it('refuses an employee the document is for, through their own slot or a team slot', () => {
		const requestedFor = { employeeIds: [MALLORY.employeeId] };

		expect(() => answerRequestApproval(malloryListed(), APPROVED, as(MALLORY), requestedFor)).toThrow(
			ForbiddenException
		);
		expect(() =>
			answerRequestApproval(financeOnly(), APPROVED, as(MALLORY, { teamIds: [FINANCE] }), requestedFor)
		).toThrow(ForbiddenException);
	});

	it('lets the other approvers answer a request that is for someone else', () => {
		const row = malloryListed({
			employeeApprovals: [{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }]
		});

		const outcome = answerRequestApproval(row, APPROVED, as(ALICE, { teamIds: [FINANCE] }), {
			userIds: [MALLORY.userId],
			employeeIds: [MALLORY.employeeId]
		});

		expect(outcome.status).toBe(APPROVED);
	});

	it('still lets a tenant administrator decide a request that is for them', () => {
		const ADMIN = { userId: 'user-admin', employeeId: 'employee-admin' };

		const outcome = answerRequestApproval(request(), APPROVED, as(ADMIN, { isTenantAdmin: true }), {
			userIds: [ADMIN.userId],
			employeeIds: [ADMIN.employeeId]
		});

		expect(outcome.status).toBe(APPROVED);
	});

	it.each([
		['the user who raised it', { createdByUserId: MALLORY.userId }, null, true],
		['the user who filed its document', {}, { userIds: [MALLORY.userId] }, true],
		['an employee its document is for', {}, { employeeIds: [MALLORY.employeeId] }, true],
		['somebody else', {}, { userIds: [ALICE.userId], employeeIds: [ALICE.employeeId] }, false],
		['nobody named', { createdByUserId: null }, { userIds: [null], employeeIds: [undefined] }, false]
	])('isRequesterOfRequestApproval: %s → %p', (_, row, requestedFor, expected) => {
		expect(isRequesterOfRequestApproval(row as any, MALLORY, requestedFor as any)).toBe(expected);
	});
});
