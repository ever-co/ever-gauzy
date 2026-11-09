import { BaseEntityEnum, InboxItemKindEnum, InboxItemStatusEnum, InboxTabEnum } from '@gauzy/contracts';
import {
	activityOf,
	apiTabOf,
	dateGroupOf,
	dueStateOf,
	emailBlocksOf,
	emailHeaderOf,
	escalationDetails,
	groupByDate,
	isDone,
	isSnoozed,
	isTranslationKey,
	isTypingTarget,
	notificationIconOf,
	notificationTypeLabelOf,
	senderOf,
	undoOf,
	isUnread,
	kindIconOf,
	linksOf,
	listDateFormat,
	listedIn,
	optionsOf,
	previewOf,
	replaceItem,
	mailboxLabelOf,
	replyProblem,
	routedNoticeOf,
	snoozeUntil,
	sourceLabelOf
} from './inbox-ui.helpers';

const open = { kind: InboxItemKindEnum.QUESTION, status: InboxItemStatusEnum.OPEN, requireReason: false };

describe('Inbox UI helpers', () => {
	it('gives each kind its icon, and an unknown kind the inbox icon', () => {
		expect(kindIconOf(InboxItemKindEnum.EMAIL)).toBe('email-outline');
		expect(kindIconOf(InboxItemKindEnum.ESCALATION)).toBe('alert-triangle-outline');
		expect(kindIconOf('SOMETHING_ELSE')).toBe('inbox-outline');
		expect(kindIconOf(null)).toBe('inbox-outline');
	});

	it('shows a list row time as messaging apps do: time today, day this year, full date before', () => {
		const now = new Date(2026, 10, 9, 15, 0);
		expect(listDateFormat(new Date(2026, 10, 9, 4, 21), now)).toBe('shortTime');
		expect(listDateFormat(new Date(2026, 2, 1), now)).toBe('MMM d');
		expect(listDateFormat(new Date(2025, 11, 31), now)).toBe('mediumDate');
		expect(listDateFormat(null, now)).toBe('short');
		expect(listDateFormat('not a date', now)).toBe('short');
	});

	it('previews a body on one line, at most 160 characters', () => {
		expect(previewOf('  Hello\n\n  world  ')).toBe('Hello world');
		expect(previewOf(null)).toBe('');
		expect(previewOf('x'.repeat(200))).toHaveLength(160);
	});

	it('maps the page tabs onto the API tabs; Notifications is none of them', () => {
		expect(apiTabOf('all')).toBe(InboxTabEnum.ALL);
		expect(apiTabOf('decisions')).toBe(InboxTabEnum.DECISIONS);
		expect(apiTabOf('email')).toBe(InboxTabEnum.EMAIL);
		expect(apiTabOf('snoozed')).toBe(InboxTabEnum.SNOOZED);
		expect(apiTabOf('done')).toBe(InboxTabEnum.DONE);
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
		// A notification about a comment opens its task at the comment.
		expect(linksOf({ taskId: 't', entity: BaseEntityEnum.Comment, entityId: 'c' })).toEqual([
			{ kind: 'comment', commands: ['/pages/tasks/view', 't'], queryParams: { tab: 'comments', comment: 'c' } }
		]);
		expect(linksOf({ entity: BaseEntityEnum.Comment, entityId: 'c' })).toEqual([]);
	});

	it('reads my recipient state; a reader without one sees the item as read', () => {
		const now = new Date('2026-10-16T12:00:00Z');
		const recipient = { isRead: false, isArchived: false, snoozedUntil: new Date('2026-10-16T13:00:00Z') };
		expect(isUnread({ recipient })).toBe(true);
		expect(isUnread({ recipient: null })).toBe(false);
		expect(isDone({ recipient })).toBe(false);
		expect(isDone({ recipient: { ...recipient, isDone: true } })).toBe(true);
		expect(isDone({ recipient: { ...recipient, doneAt: new Date('2026-10-16T12:30:00Z') } })).toBe(true);
		expect(isDone({ recipient: null })).toBe(false);
		expect(isSnoozed({ recipient }, now)).toBe(true);
		expect(isSnoozed({ recipient: { ...recipient, snoozedUntil: new Date('2026-10-16T11:00:00Z') } }, now)).toBe(
			false
		);
	});

	it('lists an item under the tabs the API lists it under, whichever state changed', () => {
		const now = new Date('2026-10-16T12:00:00Z');
		const later = new Date('2026-10-16T13:00:00Z');
		const plain = { recipient: { isRead: true, isArchived: false, snoozedUntil: null } };
		const archivedDone = { recipient: { isRead: true, isArchived: true, snoozedUntil: null, isDone: true } };
		const doneSnoozed = { recipient: { isRead: true, isArchived: false, snoozedUntil: later, isDone: true } };
		const snoozed = { recipient: { isRead: true, isArchived: false, snoozedUntil: later } };
		const woken = { recipient: { isRead: true, isArchived: false, snoozedUntil: new Date('2026-10-16T11:00:00Z') } };
		const tabs = ['all', 'decisions', 'email', 'snoozed', 'done', 'archived', 'notifications'] as const;
		const listing = (item: Parameters<typeof listedIn>[1]) => tabs.filter((tab) => listedIn(tab, item, now));
		expect(listing(plain)).toEqual(['all', 'decisions', 'email']);
		expect(listing(archivedDone)).toEqual(['archived']);
		expect(listing(doneSnoozed)).toEqual(['done']);
		expect(listing(snoozed)).toEqual(['snoozed']);
		expect(listing(woken)).toEqual(['all', 'decisions', 'email']);
		expect(listing({ recipient: null })).toEqual(['all', 'decisions', 'email']);
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

	it('names the (virtual) mailbox a source lists an item under, as text', () => {
		expect(mailboxLabelOf({ metadata: { mailbox: 'Ever Works — Builder' } } as never)).toBe('Ever Works — Builder');
		expect(mailboxLabelOf({ metadata: { mailbox: '  ' } } as never)).toBeNull();
		expect(mailboxLabelOf({ metadata: { mailbox: 42 } } as never)).toBeNull();
		expect(mailboxLabelOf({ metadata: null } as never)).toBeNull();
		expect(mailboxLabelOf({ metadata: { mailbox: 'x'.repeat(200) } } as never)).toHaveLength(120);
	});

	describe('the list sections, due labels, undo, shortcuts, notifications and activity', () => {
		// Wednesday 11 November 2026, 15:00 local time.
		const now = new Date(2026, 10, 11, 15, 0, 0);

		it('sections a row by the day it came: today, yesterday, the 7 days before, older', () => {
			expect(dateGroupOf(new Date(2026, 10, 11, 0, 5), now)).toBe('TODAY');
			expect(dateGroupOf(new Date(2026, 10, 10, 23, 59), now)).toBe('YESTERDAY');
			expect(dateGroupOf(new Date(2026, 10, 10, 0, 0), now)).toBe('YESTERDAY');
			expect(dateGroupOf(new Date(2026, 10, 5, 12, 0), now)).toBe('THIS_WEEK');
			expect(dateGroupOf(new Date(2026, 10, 1, 12, 0), now)).toBe('OLDER');
			expect(dateGroupOf(null, now)).toBe('OLDER');
			expect(dateGroupOf('not a date', now)).toBe('OLDER');
		});

		it('groups rows in their sections, keeping their order', () => {
			const rows = [
				{ id: 'a', createdAt: new Date(2026, 10, 11, 9) },
				{ id: 'b', createdAt: new Date(2026, 10, 11, 8) },
				{ id: 'c', createdAt: new Date(2026, 10, 10, 8) },
				{ id: 'd', createdAt: new Date(2026, 9, 1) }
			];
			expect(groupByDate(rows, now).map((section) => [section.group, section.items.map((row) => row.id)])).toEqual([
				['TODAY', ['a', 'b']],
				['YESTERDAY', ['c']],
				['OLDER', ['d']]
			]);
			expect(groupByDate([], now)).toEqual([]);
		});

		it('shows the due date of an open item only: overdue, due today, or due later', () => {
			const due = (dueAt: Date | null, extra: object = {}) =>
				({ dueAt, status: InboxItemStatusEnum.OPEN, recipient: { isRead: true }, ...extra }) as never;
			expect(dueStateOf(due(new Date(2026, 10, 11, 9)), now)).toBe('OVERDUE');
			expect(dueStateOf(due(new Date(2026, 10, 11, 18)), now)).toBe('TODAY');
			expect(dueStateOf(due(new Date(2026, 10, 14, 9)), now)).toBe('UPCOMING');
			expect(dueStateOf(due(null), now)).toBeNull();
			expect(dueStateOf(due(new Date(2026, 10, 1), { status: InboxItemStatusEnum.ANSWERED }), now)).toBeNull();
			expect(dueStateOf(due(new Date(2026, 10, 1), { recipient: { isRead: true, isDone: true } }), now)).toBeNull();
		});

		it('offers to undo archive, done and snooze, with the change that takes each back', () => {
			const before = { recipient: { isRead: true, isArchived: false, snoozedUntil: null } } as never;
			expect(undoOf({ isArchived: true }, before)).toEqual({ kind: 'ARCHIVED', revert: { isArchived: false } });
			const archived = { recipient: { isRead: true, isArchived: true, snoozedUntil: null } } as never;
			expect(undoOf({ isArchived: false }, archived)).toEqual({ kind: 'UNARCHIVED', revert: { isArchived: true } });
			expect(undoOf({ isDone: true }, before)).toEqual({ kind: 'DONE', revert: { isDone: false } });
			expect(undoOf({ snoozedUntil: '2099-01-01T09:00:00.000Z' }, before)).toEqual({
				kind: 'SNOOZED',
				revert: { snoozedUntil: null }
			});
			// Woken up: the undo snoozes it again until the time it had.
			const snoozed = { recipient: { isRead: true, snoozedUntil: '2099-01-01T09:00:00.000Z' } } as never;
			expect(undoOf({ snoozedUntil: null }, snoozed)).toEqual({
				kind: 'UNSNOOZED',
				revert: { snoozedUntil: '2099-01-01T09:00:00.000Z' }
			});
			// The read state is its own undo.
			expect(undoOf({ isRead: true }, before)).toBeNull();
		});

		it('undoes to each item its own earlier state: an item done (or archived) before stays so', () => {
			const doneBefore = { recipient: { isRead: true, isArchived: true, isDone: true, snoozedUntil: null } } as never;
			expect(undoOf({ isDone: true }, doneBefore)).toEqual({ kind: 'DONE', revert: { isDone: true } });
			expect(undoOf({ isArchived: true }, doneBefore)).toEqual({ kind: 'ARCHIVED', revert: { isArchived: true } });
		});

		it('counts days by the calendar, also across a clock change (a 23- or 25-hour day)', () => {
			// 30 March 2026, 00:30: in Europe the day before had 23 hours. 28 March, 23:30, is two days back.
			const afterClockChange = new Date(2026, 2, 30, 0, 30);
			expect(dateGroupOf(new Date(2026, 2, 29, 0, 0), afterClockChange)).toBe('YESTERDAY');
			expect(dateGroupOf(new Date(2026, 2, 28, 23, 30), afterClockChange)).toBe('THIS_WEEK');
			expect(dateGroupOf(new Date(2026, 2, 23, 0, 0), afterClockChange)).toBe('THIS_WEEK');
			expect(dateGroupOf(new Date(2026, 2, 22, 23, 59), afterClockChange)).toBe('OLDER');
		});

		it('never takes a shortcut typed in a field', () => {
			expect(isTypingTarget(document.createElement('input'))).toBe(true);
			expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
			expect(isTypingTarget(document.createElement('select'))).toBe(true);
			expect(isTypingTarget(document.createElement('div'))).toBe(false);
			expect(isTypingTarget(null)).toBe(false);
		});

		it("names a notification's type, with its icon; a bell and no label for a type it does not know", () => {
			expect(notificationIconOf('Mention')).toBe('at-outline');
			expect(notificationTypeLabelOf('Mention')).toBe('INBOX.NOTIFICATIONS.TYPE.Mention');
			expect(notificationIconOf('Unknown')).toBe('bell-outline');
			expect(notificationTypeLabelOf('Unknown')).toBeNull();
			expect(notificationTypeLabelOf(undefined)).toBeNull();
		});

		it("reads a notification's sender: name, picture and initials; none without a joined sender", () => {
			expect(
				senderOf({ sentByEmployee: { user: { firstName: 'Ada', lastName: 'Lovelace', imageUrl: 'a.png' } } } as never)
			).toEqual({ name: 'Ada Lovelace', imageUrl: 'a.png', initials: 'AL' });
			expect(senderOf({ sentByEmployee: { fullName: 'grace' } } as never)).toEqual({
				name: 'grace',
				imageUrl: null,
				initials: 'G'
			});
			expect(senderOf({ sentByEmployee: undefined } as never)).toBeNull();
			expect(senderOf({ sentByEmployee: { user: {} } } as never)).toBeNull();
		});

		it("reads an email's header: the sender's name and address, the mailbox, attachments and a spam doubt", () => {
			expect(
				emailHeaderOf({
					metadata: {
						from: 'Sarah Connor <sarah@acme.example>',
						mailboxAddress: 'sales@example.com',
						attachments: 2,
						spamVerdict: 'suspect'
					}
				} as never)
			).toEqual({
				fromName: 'Sarah Connor',
				fromAddress: 'sarah@acme.example',
				initials: 'SC',
				to: 'sales@example.com',
				attachments: 2,
				spam: 'suspect'
			});
			// An address alone is the name; a clean message has no spam doubt.
			expect(emailHeaderOf({ metadata: { from: 'billing@vendor.example', spamVerdict: 'ham' } } as never)).toEqual({
				fromName: 'billing@vendor.example',
				fromAddress: null,
				initials: 'B',
				to: null,
				attachments: 0,
				spam: null
			});
			expect(emailHeaderOf({ metadata: null } as never).fromName).toBeNull();
		});

		it('sets a plain-text email in blocks: what was written, quotes, the signature', () => {
			expect(emailBlocksOf('Hi,\n\nThanks.\n> On Monday:\n> Hello\n\n-- \nSarah\nAcme')).toEqual([
				{ kind: 'text', text: 'Hi,\n\nThanks.' },
				{ kind: 'quote', text: 'On Monday:\nHello' },
				{ kind: 'signature', text: 'Sarah\nAcme' }
			]);
			expect(emailBlocksOf(null)).toEqual([]);
			expect(emailBlocksOf('One line')).toEqual([{ kind: 'text', text: 'One line' }]);
		});

		it("tells an item's history, oldest first, from the times it carries", () => {
			const item = {
				createdAt: new Date(2026, 10, 10, 9),
				response: { answeredAt: new Date(2026, 10, 11, 10) },
				recipient: {
					isRead: true,
					readAt: new Date(2026, 10, 10, 12),
					isArchived: true,
					archivedAt: new Date(2026, 10, 11, 11),
					snoozedUntil: null
				}
			} as never;
			expect(activityOf(item, now).map((step) => step.event)).toEqual(['RECEIVED', 'READ', 'ANSWERED', 'ARCHIVED']);
			// A running snooze shows at the time it ends; a past one is left out.
			const snoozed = {
				createdAt: new Date(2026, 10, 10, 9),
				recipient: { isRead: false, readAt: new Date(2026, 10, 10, 9, 30), snoozedUntil: new Date(2026, 10, 12, 9) }
			} as never;
			expect(activityOf(snoozed, now).map((step) => step.event)).toEqual(['RECEIVED', 'SNOOZED']);
		});
	});
});
