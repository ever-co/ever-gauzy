import {
	IInboxItem,
	IInboxItemOption,
	IInboxItemWithState,
	INBOX_DECISION_KINDS,
	InboxItemKindEnum,
	InboxItemStatusEnum,
	InboxTabEnum
} from '@gauzy/contracts';
import { INBOX_EMPLOYEE_LINK, INBOX_PROJECT_LINK, INBOX_TASK_LINK } from './inbox-ui.constants';

/** The page's tabs: the API's item tabs plus Notifications (read live from `/employee-notification`). */
export type InboxUiTab = 'all' | 'decisions' | 'email' | 'notifications' | 'snoozed' | 'archived';

export const INBOX_UI_TABS: readonly InboxUiTab[] = [
	'all',
	'decisions',
	'email',
	'notifications',
	'snoozed',
	'archived'
];

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
	kind: 'task' | 'project' | 'agent';
	commands: string[];
}

/** The task, project and agent an item links to, as router commands. */
export function linksOf(item: Pick<IInboxItem, 'taskId' | 'projectId' | 'agentEmployeeId'>): InboxItemLink[] {
	const links: InboxItemLink[] = [];
	if (item.taskId) links.push({ kind: 'task', commands: [INBOX_TASK_LINK, item.taskId] });
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

/** Replaces an item of a list by its new version (same id), keeping the order. */
export function replaceItem<T extends { id?: string }>(items: readonly T[], next: T): T[] {
	return items.map((item) => (item.id === next.id ? next : item));
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
