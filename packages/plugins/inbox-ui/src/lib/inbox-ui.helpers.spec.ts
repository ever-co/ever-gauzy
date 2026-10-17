import { InboxItemKindEnum, InboxItemStatusEnum, InboxTabEnum } from '@gauzy/contracts';
import {
	apiTabOf,
	escalationDetails,
	isSnoozed,
	isTranslationKey,
	isUnread,
	linksOf,
	optionsOf,
	replaceItem,
	replyProblem,
	routedNoticeOf,
	snoozeUntil,
	sourceLabelOf
} from './inbox-ui.helpers';

const open = { kind: InboxItemKindEnum.QUESTION, status: InboxItemStatusEnum.OPEN, requireReason: false };

describe('Inbox UI helpers', () => {
	it('maps the page tabs onto the API tabs; Notifications is none of them', () => {
		expect(apiTabOf('all')).toBe(InboxTabEnum.ALL);
		expect(apiTabOf('decisions')).toBe(InboxTabEnum.DECISIONS);
		expect(apiTabOf('email')).toBe(InboxTabEnum.EMAIL);
		expect(apiTabOf('snoozed')).toBe(InboxTabEnum.SNOOZED);
		expect(apiTabOf('archived')).toBe(InboxTabEnum.ARCHIVED);
		expect(apiTabOf('notifications')).toBeNull();
	});

	it('checks a reply as the API does', () => {
		expect(replyProblem(open, 'Go', null)).toBeNull();
		expect(replyProblem(open, '', 'yes')).toBeNull();
		expect(replyProblem(open, '   ', null)).toBe('EMPTY');
		expect(replyProblem({ ...open, requireReason: true }, '', 'yes')).toBe('REASON_REQUIRED');
		expect(replyProblem({ ...open, status: InboxItemStatusEnum.ANSWERED }, 'x', null)).toBe('NOT_OPEN');
		expect(replyProblem({ ...open, kind: InboxItemKindEnum.NOTICE }, 'x', null)).toBe('NOT_DECISION');
		expect(replyProblem(open, 'x'.repeat(10_001), null)).toBe('TOO_LONG');
	});

	it('offers an item its own options, and an approval without any Approve / Reject', () => {
		const options = [{ id: 'a', label: 'A', recommended: true }];
		expect(optionsOf({ kind: InboxItemKindEnum.QUESTION, options })).toBe(options);
		expect(optionsOf({ kind: InboxItemKindEnum.QUESTION, options: null })).toEqual([]);
		const approval = optionsOf({ kind: InboxItemKindEnum.APPROVAL, options: [] });
		expect(approval.map((option) => option.id)).toEqual(['approve', 'reject']);
		expect(approval.every((option) => isTranslationKey(option.label))).toBe(true);
		expect(isTranslationKey('Ship it')).toBe(false);
	});

	it('reads an escalation: attempts, the decision needed, confidence on either scale', () => {
		expect(
			escalationDetails({
				metadata: { attempted: ['retry', '', 7], decisionNeeded: 'Pick a vendor', confidence: 0.42 }
			})
		).toEqual({ attempted: ['retry'], decisionNeeded: 'Pick a vendor', confidence: 42 });
		expect(escalationDetails({ metadata: { attempted: 'one thing', confidence: 80 } })).toEqual({
			attempted: ['one thing'],
			decisionNeeded: null,
			confidence: 80
		});
		expect(escalationDetails({ metadata: null })).toEqual({
			attempted: [],
			decisionNeeded: null,
			confidence: null
		});
	});

	it('snoozes for an hour, until tomorrow 09:00, or until next Monday 09:00', () => {
		// A Wednesday afternoon.
		const now = new Date(2026, 9, 14, 15, 30, 0);
		expect(snoozeUntil('hour', now).getTime()).toBe(now.getTime() + 3_600_000);
		expect(snoozeUntil('tomorrow', now)).toEqual(new Date(2026, 9, 15, 9, 0, 0, 0));
		expect(snoozeUntil('next-week', now)).toEqual(new Date(2026, 9, 19, 9, 0, 0, 0));
		// On a Monday, "next week" is the Monday after.
		expect(snoozeUntil('next-week', new Date(2026, 9, 19, 8, 0))).toEqual(new Date(2026, 9, 26, 9, 0, 0, 0));
	});

	it('links the task, the project and the agent', () => {
		expect(linksOf({ taskId: 't', projectId: 'p', agentEmployeeId: 'e' })).toEqual([
			{ kind: 'task', commands: ['/pages/tasks/view', 't'] },
			{ kind: 'project', commands: ['/pages/organization/projects', 'p', 'edit'] },
			{ kind: 'agent', commands: ['/pages/employees/view', 'e'] }
		]);
		expect(linksOf({})).toEqual([]);
	});

	it('reads my recipient state; a reader without one sees the item as read', () => {
		const now = new Date('2026-10-16T12:00:00Z');
		const recipient = { isRead: false, isArchived: false, snoozedUntil: new Date('2026-10-16T13:00:00Z') };
		expect(isUnread({ recipient })).toBe(true);
		expect(isUnread({ recipient: null })).toBe(false);
		expect(isSnoozed({ recipient }, now)).toBe(true);
		expect(isSnoozed({ recipient: { ...recipient, snoozedUntil: new Date('2026-10-16T11:00:00Z') } }, now)).toBe(
			false
		);
	});

	it('names the known sources through translations and shows any other as stated', () => {
		expect(sourceLabelOf('EVER_WORKS')).toBe('INBOX.SOURCE.EVER_WORKS');
		expect(sourceLabelOf('BILLING')).toBe('BILLING');
	});

	it('replaces an item in place', () => {
		expect(
			replaceItem(
				[
					{ id: 'a', n: 1 },
					{ id: 'b', n: 1 }
				],
				{ id: 'b', n: 2 }
			)
		).toEqual([
			{ id: 'a', n: 1 },
			{ id: 'b', n: 2 }
		]);
	});

	it('says "Already decided in <source>" when the source had decided the item first, else where the reply went', () => {
		const answered = (routed: string | null, source = 'EVER_WORKS') =>
			({ source, response: { answeredByUserId: 'u1', answeredAt: '2026-10-17T00:00:00Z', routed } }) as never;
		expect(routedNoticeOf(answered('already-decided'))).toEqual({
			alreadyDecided: true,
			source: 'INBOX.SOURCE.EVER_WORKS'
		});
		expect(routedNoticeOf(answered('already-decided', 'ACME'))).toEqual({ alreadyDecided: true, source: 'ACME' });
		expect(routedNoticeOf(answered('already-decided', ''))).toEqual({
			alreadyDecided: true,
			source: 'INBOX.THE_SOURCE'
		});
		expect(routedNoticeOf(answered('resumed'))).toEqual({ alreadyDecided: false, routed: 'resumed' });
		expect(routedNoticeOf(answered('local'))).toBeNull();
		expect(routedNoticeOf(answered(null))).toBeNull();
		expect(routedNoticeOf({ source: 'GAUZY', response: null } as never)).toBeNull();
	});
});
