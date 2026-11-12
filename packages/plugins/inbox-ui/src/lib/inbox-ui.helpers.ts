import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	IEmployeeNotification,
	IInboxItem,
	IInboxItemOption,
	IInboxItemWithState,
	IInboxRecipientStateInput,
	INBOX_DECISION_KINDS,
	InboxItemKindEnum,
	InboxItemStatusEnum,
	InboxTabEnum
} from '@gauzy/contracts';
import { INBOX_EMPLOYEE_LINK, INBOX_PROJECT_LINK, INBOX_TASK_LINK } from './inbox-ui.constants';

/** The page's tabs: the API's item tabs plus Notifications (read live from `/employee-notification`). */
export type InboxUiTab = 'all' | 'decisions' | 'email' | 'notifications' | 'snoozed' | 'done' | 'archived';

export const INBOX_UI_TABS: readonly InboxUiTab[] = [
	'all',
	'decisions',
	'email',
	'notifications',
	'snoozed',
	'done',
	'archived'
];

/** The icon before each tab's label (the task page's tab bar). */
export const INBOX_UI_TAB_ICONS: Readonly<Record<InboxUiTab, string>> = {
	all: 'inbox-outline',
	decisions: 'checkmark-square-2-outline',
	email: 'email-outline',
	notifications: 'bell-outline',
	snoozed: 'clock-outline',
	done: 'checkmark-circle-2-outline',
	archived: 'archive-outline'
};

/** The API tab of a page tab (`null` for Notifications, which is not an inbox tab). */
export function apiTabOf(tab: InboxUiTab): InboxTabEnum | null {
	switch (tab) {
		case 'all':
			return InboxTabEnum.ALL;
		case 'decisions':
			return InboxTabEnum.DECISIONS;
		case 'email':
			return InboxTabEnum.EMAIL;
		case 'snoozed':
			return InboxTabEnum.SNOOZED;
		case 'done':
			return InboxTabEnum.DONE;
		case 'archived':
			return InboxTabEnum.ARCHIVED;
		default:
			return null;
	}
}

/** The longest reply the API takes. */
export const INBOX_REPLY_MAX = 10_000;

/** Why a reply cannot be sent yet (a translation key under `INBOX.REPLY`), or `null` when it can. */
export type InboxReplyProblem = 'NOT_DECISION' | 'NOT_OPEN' | 'EMPTY' | 'REASON_REQUIRED' | 'TOO_LONG';

/** Checks a reply as the API will, so the composer explains itself before sending. */
export function replyProblem(
	item: Pick<IInboxItem, 'kind' | 'status' | 'requireReason'>,
	text: string | null | undefined,
	optionId: string | null | undefined
): InboxReplyProblem | null {
	if (!INBOX_DECISION_KINDS.includes(item.kind)) return 'NOT_DECISION';
	if (item.status !== InboxItemStatusEnum.OPEN) return 'NOT_OPEN';
	const trimmed = (text ?? '').trim();
	if (!trimmed && !optionId) return 'EMPTY';
	if (item.requireReason && !trimmed) return 'REASON_REQUIRED';
	if (trimmed.length > INBOX_REPLY_MAX) return 'TOO_LONG';
	return null;
}

/**
 * The choices a decision offers. An item's own options come first; an approval without any gets Approve /
 * Reject (`approve` / `reject`, which the API accepts for an item that lists no options).
 */
export function optionsOf(item: Pick<IInboxItem, 'kind' | 'options'>): IInboxItemOption[] {
	if (item.options?.length) return item.options;
	if (item.kind === InboxItemKindEnum.APPROVAL) {
		return [
			{ id: 'approve', label: 'INBOX.APPROVAL.APPROVE' },
			{ id: 'reject', label: 'INBOX.APPROVAL.REJECT' }
		];
	}
	return [];
}

/** Whether an option's label is one of the plugin's translation keys (the Approve / Reject defaults). */
export function isTranslationKey(label: string): boolean {
	return /^INBOX\.[A-Z_.]+$/.test(label);
}

/** What an escalation's source told about it (`metadata`: what was tried, the decision needed, confidence). */
export interface InboxEscalationDetails {
	attempted: string[];
	decisionNeeded: string | null;
	/** 0..100, or `null`. */
	confidence: number | null;
}

export function escalationDetails(item: Pick<IInboxItem, 'metadata'>): InboxEscalationDetails {
	const metadata = (item.metadata ?? {}) as Record<string, unknown>;
	const attemptedRaw = metadata['attempted'];
	const attempted = Array.isArray(attemptedRaw)
		? attemptedRaw.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
		: typeof attemptedRaw === 'string' && attemptedRaw.trim()
			? [attemptedRaw]
			: [];
	const decision = metadata['decisionNeeded'] ?? metadata['decision'];
	const confidenceRaw = Number(metadata['confidence']);
	// A source may send 0..1 or 0..100.
	const confidence = Number.isFinite(confidenceRaw)
		? Math.round(Math.min(Math.max(confidenceRaw <= 1 ? confidenceRaw * 100 : confidenceRaw, 0), 100))
		: null;
	return {
		attempted,
		decisionNeeded: typeof decision === 'string' && decision.trim() ? decision : null,
		confidence: metadata['confidence'] === undefined || metadata['confidence'] === null ? null : confidence
	};
}

/** Snooze choices of the detail pane. */
export type InboxSnoozePreset = 'hour' | 'tomorrow' | 'next-week';

export const INBOX_SNOOZE_PRESETS: readonly InboxSnoozePreset[] = ['hour', 'tomorrow', 'next-week'];

/** When a snooze preset ends: in an hour, tomorrow at 09:00, or next Monday at 09:00 (local time). */
export function snoozeUntil(preset: InboxSnoozePreset, now: Date = new Date()): Date {
	const until = new Date(now.getTime());
	if (preset === 'hour') {
		until.setTime(now.getTime() + 60 * 60 * 1000);
		return until;
	}
	const days = preset === 'tomorrow' ? 1 : (8 - now.getDay()) % 7 || 7;
	until.setDate(now.getDate() + days);
	until.setHours(9, 0, 0, 0);
	return until;
}

/** One of the links of an item (the detail pane's "Open …" buttons). */
export interface InboxItemLink {
	kind: 'task' | 'comment' | 'project' | 'agent';
	commands: string[];
	queryParams?: Record<string, string>;
}

/**
 * The task, project and agent an item links to, as router commands. A notification about a comment (a comment on
 * a record I follow, a mention in one) opens its task at the comment (`?comment=`), rather than the task alone.
 */
export function linksOf(item: Pick<IInboxItem, 'taskId' | 'projectId' | 'agentEmployeeId' | 'entity' | 'entityId'>): InboxItemLink[] {
	const links: InboxItemLink[] = [];
	if (item.taskId) {
		links.push(
			item.entity === BaseEntityEnum.Comment && item.entityId
				? { kind: 'comment', commands: [INBOX_TASK_LINK, item.taskId], queryParams: { tab: 'comments', comment: String(item.entityId) } }
				: { kind: 'task', commands: [INBOX_TASK_LINK, item.taskId] }
		);
	}
	if (item.projectId) links.push({ kind: 'project', commands: [INBOX_PROJECT_LINK, item.projectId, 'edit'] });
	if (item.agentEmployeeId) links.push({ kind: 'agent', commands: [INBOX_EMPLOYEE_LINK, item.agentEmployeeId] });
	return links;
}

/** Whether the caller has read the item (no recipient row: a mailbox reader's view, treated as read). */
export function isUnread(item: Pick<IInboxItemWithState, 'recipient'>): boolean {
	return !!item.recipient && !item.recipient.isRead;
}

/** Whether the caller has the item archived. */
export function isArchived(item: Pick<IInboxItemWithState, 'recipient'>): boolean {
	return !!item.recipient?.isArchived;
}

/** Whether a snooze of the caller is still running. */
export function isSnoozed(item: Pick<IInboxItemWithState, 'recipient'>, now: Date = new Date()): boolean {
	const until = item.recipient?.snoozedUntil ? new Date(item.recipient.snoozedUntil) : null;
	return !!until && !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

/** Whether the caller has the item done (`isDone` as the API answers it, else the time it was done). */
export function isDone(item: Pick<IInboxItemWithState, 'recipient'>): boolean {
	return !!item.recipient && (item.recipient.isDone ?? !!item.recipient.doneAt);
}

/**
 * Whether a tab lists an item with my state as the API answered it — the API's own rules (`InboxService.recipientItems`):
 * Archived lists what is archived, whatever else; Done lists what is done and not archived, snoozed or not; Snoozed
 * lists what is snoozed, not archived and not done; the open tabs list the rest (snoozed items once their time has
 * come). Notifications is not an item tab.
 */
export function listedIn(tab: InboxUiTab, item: Pick<IInboxItemWithState, 'recipient'>, now: Date = new Date()): boolean {
	if (tab === 'notifications') return false;
	const archived = isArchived(item);
	if (tab === 'archived') return archived;
	if (archived) return false;
	const done = isDone(item);
	if (tab === 'done') return done;
	if (done) return false;
	const snoozed = isSnoozed(item, now);
	return tab === 'snoozed' ? snoozed : !snoozed;
}

/** Replaces an item of a list by its new version (same id), keeping the order. */
export function replaceItem<T extends { id?: string }>(items: readonly T[], next: T): T[] {
	return items.map((item) => (item.id === next.id ? next : item));
}

/** The icon of each kind, on the list's avatars and the detail's header. */
const INBOX_KIND_ICONS: Readonly<Record<string, string>> = {
	[InboxItemKindEnum.QUESTION]: 'question-mark-circle-outline',
	[InboxItemKindEnum.APPROVAL]: 'checkmark-square-2-outline',
	[InboxItemKindEnum.ESCALATION]: 'alert-triangle-outline',
	[InboxItemKindEnum.NOTICE]: 'info-outline',
	[InboxItemKindEnum.NOTIFICATION]: 'bell-outline',
	[InboxItemKindEnum.EMAIL]: 'email-outline'
};

/** The icon of an item's kind (a generic inbox icon for a kind the plugin does not know). */
export function kindIconOf(kind: string | null | undefined): string {
	return (kind && INBOX_KIND_ICONS[kind]) || 'inbox-outline';
}

/**
 * The `DatePipe` format of a list row's time, as messaging apps show it: the time for today, the day and month for
 * this year, the full date for an older item.
 */
export function listDateFormat(value: Date | string | null | undefined, now: Date = new Date()): string {
	const date = value ? new Date(value) : null;
	if (!date || Number.isNaN(date.getTime())) return 'short';
	if (date.toDateString() === now.toDateString()) return 'shortTime';
	if (date.getFullYear() === now.getFullYear()) return 'MMM d';
	return 'mediumDate';
}

/** The one-line preview of a body under a list row's title: its text on one line, at most 160 characters. */
export function previewOf(body: string | null | undefined): string {
	return (body ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** The sources the plugin names (a translation key under `INBOX.SOURCE`); any other is shown as stated. */
export function sourceLabelOf(source: string | null | undefined): string {
	const known = ['EVER_WORKS', 'EMAIL', 'GAUZY', 'SYSTEM'];
	return source && known.includes(source) ? `INBOX.SOURCE.${source}` : (source ?? '');
}

/**
 * The mailbox a source lists an item under (`metadata.mailbox`, e.g. "Ever Works — Builder" for a read-only copy of an
 * Ever Works agent's mail), or `null`. Text only, at most 120 characters.
 */
export function mailboxLabelOf(item: Pick<IInboxItem, 'metadata'>): string | null {
	const value = (item.metadata as Record<string, unknown> | null | undefined)?.['mailbox'];
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : null;
}

/**
 * What a source answers a reply with when the item was already decided there (another answer won, in the
 * source or from another client): the item then carries the source's own answer, not the reply sent here.
 */
export const INBOX_ROUTED_ALREADY_DECIDED = 'already-decided';

/** The line under an answer saying where the reply went (`null`: nothing to say, e.g. a local item). */
export type InboxRoutedNotice = { alreadyDecided: true; source: string } | { alreadyDecided: false; routed: string };

/**
 * The routing line of an answered item: "Already decided in <source>" when the source had decided it before
 * the reply (its own answer is shown), else "Delivered: <routed>"; nothing for a local answer.
 */
export function routedNoticeOf(item: Pick<IInboxItem, 'response' | 'source'>): InboxRoutedNotice | null {
	const routed = item.response?.routed;
	if (!routed || routed === 'local') return null;
	if (routed === INBOX_ROUTED_ALREADY_DECIDED) {
		return { alreadyDecided: true, source: sourceLabelOf(item.source) || 'INBOX.THE_SOURCE' };
	}
	return { alreadyDecided: false, routed };
}

/** Who sent an email item and where it arrived, as its header shows them (from the item's `metadata`). */
export interface InboxEmailHeader {
	/** The sender's name, else the address; `null` when the item does not say. */
	fromName: string | null;
	/** The sender's address, shown beside a name (`null` when it is the name itself, or unknown). */
	fromAddress: string | null;
	initials: string;
	/** The mailbox's address the message came to. */
	to: string | null;
	attachments: number;
	/** The spam filter's doubt about it: `suspect` or `spam`; `null` for a clean message. */
	spam: 'suspect' | 'spam' | null;
}

export function emailHeaderOf(item: Pick<IInboxItem, 'metadata'>): InboxEmailHeader {
	const metadata = (item.metadata ?? {}) as Record<string, unknown>;
	const text = (key: string) => (typeof metadata[key] === 'string' ? (metadata[key] as string).trim() : '');
	// "Name <address>", or an address alone.
	const from = text('from');
	const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
	const fromName = (match ? match[1].trim() || match[2].trim() : from) || null;
	const fromAddress = match && match[1].trim() ? match[2].trim() : null;
	const initials = (fromName ?? '')
		.replace(/@.*$/, '')
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('');
	const attachments = Number(metadata['attachments']);
	const verdict = text('spamVerdict');
	return {
		fromName,
		fromAddress,
		initials,
		to: text('mailboxAddress') || null,
		attachments: Number.isFinite(attachments) && attachments > 0 ? Math.floor(attachments) : 0,
		spam: verdict === 'suspect' || verdict === 'spam' ? verdict : null
	};
}

/** A run of a plain-text email's lines: what was written, a quoted earlier message ("> …"), or the signature. */
export interface InboxEmailBlock {
	kind: 'text' | 'quote' | 'signature';
	text: string;
}

/**
 * A plain-text email in blocks, as mail apps set it: quoted lines (starting with ">") grouped and unquoted, and the
 * signature (after a "-- " line) apart. The text is shown as text; nothing in it is read as markup.
 */
export function emailBlocksOf(text: string | null | undefined): InboxEmailBlock[] {
	const lines = (text ?? '').replace(/\r\n?/g, '\n').split('\n');
	const blocks: InboxEmailBlock[] = [];
	let signature = false;
	const push = (kind: InboxEmailBlock['kind'], line: string) => {
		const last = blocks[blocks.length - 1];
		if (last?.kind === kind) last.text += `\n${line}`;
		else blocks.push({ kind, text: line });
	};
	for (const line of lines) {
		if (!signature && /^-- ?$/.test(line)) {
			signature = true;
			continue;
		}
		if (signature) push('signature', line);
		else if (/^\s*>/.test(line)) push('quote', line.replace(/^\s*> ?/, ''));
		else push('text', line);
	}
	return blocks
		.map((block) => ({ ...block, text: block.text.replace(/^\n+|\n+$/g, '') }))
		.filter((block) => block.text.trim() !== '');
}

/** The day sections of the message list, as mail apps group it. */
export type InboxDateGroup = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'OLDER';

/** The section of a list row: received today, yesterday, in the 7 days before, or earlier (local time). */
export function dateGroupOf(value: Date | string | null | undefined, now: Date = new Date()): InboxDateGroup {
	const date = value ? new Date(value) : null;
	if (!date || Number.isNaN(date.getTime())) return 'OLDER';
	// Local calendar days, not fixed 24-hour spans: a day a clock change shortens or lengthens (23 or 25 hours)
	// still starts at its own midnight.
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
	const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
	const time = date.getTime();
	if (time >= startOfToday) return 'TODAY';
	if (time >= startOfYesterday) return 'YESTERDAY';
	if (time >= startOfWeek) return 'THIS_WEEK';
	return 'OLDER';
}

/** The rows of a list in their day sections, keeping the list's order (newest first, as the API answers). */
export function groupByDate<T extends { createdAt?: Date | string | null }>(
	items: readonly T[],
	now: Date = new Date()
): Array<{ group: InboxDateGroup; items: T[] }> {
	const groups: Array<{ group: InboxDateGroup; items: T[] }> = [];
	for (const item of items) {
		const group = dateGroupOf(item.createdAt, now);
		const last = groups[groups.length - 1];
		if (last?.group === group) last.items.push(item);
		else groups.push({ group, items: [item] });
	}
	return groups;
}

/** How a row shows its due date: past due, due today, or due later. */
export type InboxDueState = 'OVERDUE' | 'TODAY' | 'UPCOMING';

/** The due state of an open item (`null`: no due date, or nothing left to do — answered, resolved, cancelled or done). */
export function dueStateOf(
	item: Pick<IInboxItemWithState, 'dueAt' | 'status' | 'recipient'>,
	now: Date = new Date()
): InboxDueState | null {
	const due = item.dueAt ? new Date(item.dueAt) : null;
	if (!due || Number.isNaN(due.getTime())) return null;
	if (item.status !== InboxItemStatusEnum.OPEN || isDone(item)) return null;
	if (due.getTime() < now.getTime()) return 'OVERDUE';
	if (due.toDateString() === now.toDateString()) return 'TODAY';
	return 'UPCOMING';
}

/** A change of my state that moves an item out of the list, and so is offered an "Undo". */
export type InboxUndoKind = 'ARCHIVED' | 'UNARCHIVED' | 'DONE' | 'NOT_DONE' | 'SNOOZED' | 'UNSNOOZED';

/**
 * What a change did, for the "Undo" toast, and the change that takes it back for an item as it was before it.
 * The revert is the item's own earlier state, not the opposite of the change: a bulk "Mark done" over items of
 * which some were done already must leave those done when it is undone. A change of the read state only is offered
 * no undo (`null`): "Mark unread" is its own undo.
 */
export function undoOf(
	change: IInboxRecipientStateInput,
	before: Pick<IInboxItemWithState, 'recipient'>
): { kind: InboxUndoKind; revert: IInboxRecipientStateInput } | null {
	if (change.isArchived !== undefined) {
		return { kind: change.isArchived ? 'ARCHIVED' : 'UNARCHIVED', revert: { isArchived: isArchived(before) } };
	}
	if (change.isDone !== undefined) {
		return { kind: change.isDone ? 'DONE' : 'NOT_DONE', revert: { isDone: isDone(before) } };
	}
	if (change.snoozedUntil !== undefined) {
		const previous = before.recipient?.snoozedUntil ? new Date(before.recipient.snoozedUntil) : null;
		const running = !!previous && !Number.isNaN(previous.getTime()) && previous.getTime() > Date.now();
		return {
			kind: change.snoozedUntil ? 'SNOOZED' : 'UNSNOOZED',
			revert: { snoozedUntil: running ? previous!.toISOString() : null }
		};
	}
	return null;
}

/** Whether a key press lands in a field (typing there never triggers a list shortcut). */
export function isTypingTarget(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element || typeof element.tagName !== 'string') return false;
	const tag = element.tagName.toLowerCase();
	return tag === 'input' || tag === 'textarea' || tag === 'select' || !!element.isContentEditable;
}

/** The keyboard shortcuts of the message list, for the "?" sheet: the keys and what they do (a key under `INBOX.SHORTCUTS`). */
export const INBOX_SHORTCUTS: ReadonlyArray<{ keys: readonly string[]; action: string }> = [
	{ keys: ['j'], action: 'NEXT' },
	{ keys: ['k'], action: 'PREVIOUS' },
	{ keys: ['x'], action: 'SELECT' },
	{ keys: ['e'], action: 'ARCHIVE' },
	{ keys: ['d'], action: 'DONE' },
	{ keys: ['u'], action: 'READ' },
	{ keys: ['r'], action: 'REPLY' },
	{ keys: ['/'], action: 'SEARCH' },
	{ keys: ['Esc'], action: 'CLOSE' },
	{ keys: ['?'], action: 'HELP' }
];

/** The icon of each Gauzy notification type. */
const NOTIFICATION_TYPE_ICONS: Readonly<Record<string, string>> = {
	[EmployeeNotificationTypeEnum.PAYMENT]: 'credit-card-outline',
	[EmployeeNotificationTypeEnum.ASSIGNMENT]: 'person-add-outline',
	[EmployeeNotificationTypeEnum.INVITATION]: 'email-outline',
	[EmployeeNotificationTypeEnum.MENTION]: 'at-outline',
	[EmployeeNotificationTypeEnum.COMMENT]: 'message-circle-outline',
	[EmployeeNotificationTypeEnum.MESSAGE]: 'message-square-outline',
	[EmployeeNotificationTypeEnum.BROADCAST]: 'volume-up-outline',
	[EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST]: 'trending-up-outline',
	[EmployeeNotificationTypeEnum.TASK_UPDATE]: 'edit-2-outline',
	[EmployeeNotificationTypeEnum.TIMER_REMINDER]: 'clock-outline'
};

/** The icon of a notification's type (a bell for a type the plugin does not know). */
export function notificationIconOf(type: string | null | undefined): string {
	return (type && NOTIFICATION_TYPE_ICONS[type]) || 'bell-outline';
}

/** A notification's type as a translation key under `INBOX.NOTIFICATIONS.TYPE` (`null` for a type the plugin does not know). */
export function notificationTypeLabelOf(type: string | null | undefined): string | null {
	return type && NOTIFICATION_TYPE_ICONS[type] ? `INBOX.NOTIFICATIONS.TYPE.${type}` : null;
}

/** Who sent a notification, as its row shows them (`null`: no sender, or one the API did not join). */
export interface InboxSender {
	name: string;
	imageUrl: string | null;
	initials: string;
}

export function senderOf(notification: Pick<IEmployeeNotification, 'sentByEmployee'>): InboxSender | null {
	const employee = notification.sentByEmployee;
	const user = employee?.user;
	const name = (
		user?.name ||
		[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
		employee?.fullName ||
		''
	).trim();
	if (!name) return null;
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('');
	return { name, imageUrl: user?.imageUrl || null, initials };
}

/** One step of an item's history in the reading pane (a translation key under `INBOX.ACTIVITY`). */
export interface InboxActivity {
	event: 'RECEIVED' | 'READ' | 'ANSWERED' | 'SNOOZED' | 'DONE' | 'ARCHIVED';
	at: Date;
}

/** What happened to an item, oldest first, from the times it carries (a missing or invalid time is left out). */
export function activityOf(item: IInboxItemWithState, now: Date = new Date()): InboxActivity[] {
	const recipient = item.recipient;
	const entries: Array<[InboxActivity['event'], Date | string | null | undefined]> = [
		['RECEIVED', item.createdAt],
		['READ', recipient?.isRead ? recipient.readAt : null],
		['ANSWERED', item.response?.answeredAt],
		['DONE', isDone(item) ? recipient?.doneAt : null],
		['ARCHIVED', recipient?.isArchived ? recipient.archivedAt : null],
		// A running snooze, at the time it ends.
		['SNOOZED', isSnoozed(item, now) ? recipient?.snoozedUntil : null]
	];
	return entries
		.map(([event, value]) => ({ event, at: value ? new Date(value) : null }))
		.filter((entry): entry is InboxActivity => !!entry.at && !Number.isNaN(entry.at.getTime()))
		.sort((a, b) => a.at.getTime() - b.at.getTime());
}
