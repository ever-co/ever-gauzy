import {
	BaseEntityEnum,
	IInboxItem,
	IInboxItemRecipient,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import {
	EVER_WORKS_INBOX_REPLY_MAX,
	EVER_WORKS_INBOX_WRITE_LIMITS,
	EverWorksFiledInboxItem,
	EverWorksInboxItemPatch,
	EverWorksInboxWriteState
} from '../client/ever-works-client.types';
import { EverWorksInboxKind } from './ever-works-inbox-kinds';

/** The `sourceLabel` of every item this plugin files in Ever Works. */
export const GAUZY_INBOX_SOURCE_LABEL = 'Ever Gauzy';

/** The longest choice id Ever Works keeps (an inbox option id) and the longest label this plugin sends. */
const CHOICE_ID_MAX = 64;
const CHOICE_LABEL_MAX = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A choice of a filed question or approval. */
export interface GauzyInboxChoice {
	id: string;
	label: string;
}

/**
 * The fields a Gauzy Inbox item shares with its Ever Works copy, as Gauzy last sent them (the link's snapshot `g`):
 * a field is patched only when Gauzy's value moved away from it, so what an Ever Works user did there (an answer,
 * an archive) is never undone by a later push.
 */
export interface GauzyInboxShared {
	title: string;
	body: string;
	choices: GauzyInboxChoice[] | null;
	state: EverWorksInboxWriteState;
	resolution: { choiceId?: string; text?: string } | null;
}

/**
 * The `externalId` of one recipient's copy: `<inbox item id>:<recipient row id>` (73 characters). A Gauzy item may be
 * addressed to several people while an Ever Works item has one recipient, so each person's copy has an id of its own;
 * the item id comes first, so the copy still names the Gauzy item.
 */
export function gauzyInboxExternalId(inboxItemId: string, recipientId: string): string {
	return `${inboxItemId}:${recipientId}`.slice(0, EVER_WORKS_INBOX_WRITE_LIMITS.externalId);
}

/** The Gauzy item and recipient row an `externalId` of this plugin names, or `null` for any other value. */
export function parseGauzyInboxExternalId(value: unknown): { inboxItemId: string; recipientId: string } | null {
	if (typeof value !== 'string') return null;
	const [inboxItemId, recipientId, ...rest] = value.split(':');
	if (rest.length || !UUID.test(inboxItemId ?? '') || !UUID.test(recipientId ?? '')) return null;
	return { inboxItemId, recipientId };
}

/**
 * Plain text as Markdown that reads the same: the characters that format inline (emphasis, code, links, HTML, tables,
 * strikethrough) are escaped everywhere, and what starts a block (a heading, a quote, a list item, a rule) at the
 * start of a line; line breaks are kept as hard breaks.
 */
export function plainTextAsMarkdown(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) =>
			line
				.replace(/[\\`*_[\]<>|~]/g, (character) => `\\${character}`)
				.replace(/^(\s*)([#+=-])/, '$1\\$2')
				.replace(/^(\s*\d+)([.)])/, '$1\\$2')
				.replace(/\s+$/, '')
		)
		.join('  \n');
}

/** A text cut to `max` characters (an ellipsis marks the cut). */
function cut(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The Markdown body of an item: Markdown as written, plain text (emails among them) escaped; at most 20 000. */
export function bodyOf(item: Pick<IInboxItem, 'body' | 'bodyFormat'>): string {
	const body = typeof item.body === 'string' ? item.body : '';
	const markdown = item.bodyFormat === InboxItemBodyFormatEnum.MARKDOWN ? body : plainTextAsMarkdown(body);
	return cut(markdown.trim(), EVER_WORKS_INBOX_WRITE_LIMITS.body);
}

/** The title of an item (at most 300). */
export function titleOf(item: Pick<IInboxItem, 'title'>): string {
	return cut((item.title ?? '').trim() || GAUZY_INBOX_SOURCE_LABEL, EVER_WORKS_INBOX_WRITE_LIMITS.title);
}

/**
 * The choices of a question or an approval (at most 10): the item's options; an approval without options offers
 * Approve / Reject, the ids the Gauzy Inbox itself accepts for it. Other kinds have none.
 */
export function choicesOf(item: Pick<IInboxItem, 'options'>, kind: EverWorksInboxKind): GauzyInboxChoice[] | null {
	if (kind !== 'question' && kind !== 'approval') return null;
	const options = (Array.isArray(item.options) ? item.options : [])
		.filter((option) => option && typeof option.id === 'string' && option.id && typeof option.label === 'string')
		.filter((option) => option.id.length <= CHOICE_ID_MAX)
		.slice(0, EVER_WORKS_INBOX_WRITE_LIMITS.choices)
		.map((option) => ({ id: option.id, label: cut(option.label.trim() || option.id, CHOICE_LABEL_MAX) }));
	if (options.length) return options;
	return kind === 'approval'
		? [
				{ id: 'approve', label: 'Approve' },
				{ id: 'reject', label: 'Reject' }
			]
		: null;
}

/**
 * The state of one person's copy: archived when that person archived the item (or its source cancelled it), resolved
 * once it is answered or resolved, else open.
 */
export function stateOf(
	item: Pick<IInboxItem, 'status'>,
	recipient: Pick<IInboxItemRecipient, 'isArchived'>
): EverWorksInboxWriteState {
	if (recipient.isArchived || item.status === InboxItemStatusEnum.CANCELLED) return 'archived';
	if (item.status === InboxItemStatusEnum.ANSWERED || item.status === InboxItemStatusEnum.RESOLVED) return 'resolved';
	return 'open';
}

/** The answer of an answered item, as the copy's resolution (the chosen option, the text). */
export function resolutionOf(item: Pick<IInboxItem, 'status' | 'response'>): GauzyInboxShared['resolution'] {
	const response = item.response;
	if (!response || (item.status !== InboxItemStatusEnum.ANSWERED && item.status !== InboxItemStatusEnum.RESOLVED)) return null;
	const resolution: { choiceId?: string; text?: string } = {};
	if (typeof response.optionId === 'string' && response.optionId) resolution.choiceId = response.optionId.slice(0, CHOICE_ID_MAX);
	if (typeof response.text === 'string' && response.text.trim()) resolution.text = cut(response.text.trim(), EVER_WORKS_INBOX_REPLY_MAX);
	return Object.keys(resolution).length ? resolution : null;
}

/** What Gauzy holds for one person's copy now. */
export function sharedOf(
	item: IInboxItem,
	recipient: Pick<IInboxItemRecipient, 'isArchived'>,
	kind: EverWorksInboxKind
): GauzyInboxShared {
	const state = stateOf(item, recipient);
	return {
		title: titleOf(item),
		body: bodyOf(item),
		choices: choicesOf(item, kind),
		state,
		resolution: resolutionOf(item)
	};
}

const sameChoices = (a: GauzyInboxChoice[] | null, b: GauzyInboxChoice[] | null) =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sameResolution = (a: GauzyInboxShared['resolution'], b: GauzyInboxShared['resolution']) =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The patch that brings the copy from `before` (what was last sent, or what Ever Works holds) to `now`: only the
 * fields that differ (loop guard 2: nothing differs → `null`, nothing is sent). A resolution goes with the move to
 * `resolved` only.
 */
export function patchOf(now: GauzyInboxShared, before: Partial<GauzyInboxShared>): EverWorksInboxItemPatch | null {
	const patch: EverWorksInboxItemPatch = {};
	if (before.title !== now.title) patch.title = now.title;
	if (before.body !== now.body) patch.body = now.body;
	if (now.choices && !sameChoices(now.choices, before.choices ?? null)) patch.choices = now.choices;
	if (before.state !== now.state) {
		patch.state = now.state;
		if (now.state === 'resolved' && now.resolution) patch.resolution = now.resolution;
	} else if (now.state === 'resolved' && now.resolution && !sameResolution(now.resolution, before.resolution ?? null)) {
		patch.resolution = now.resolution;
	}
	return Object.keys(patch).length ? patch : null;
}

/** The state of a filed item as Ever Works answers or announces it (the write's `state`, else the DTO's `status`). */
export function filedStateOf(item: Partial<EverWorksFiledInboxItem>): EverWorksInboxWriteState | null {
	const state = item.state ?? item.status;
	if (state === 'archived') return 'archived';
	if (state === 'resolved' || state === 'answered') return 'resolved';
	if (state === 'open') return item.answeredAt ? 'resolved' : 'open';
	return item.answeredAt ? 'resolved' : null;
}

/** The answer of a filed item (the write's `resolution`, else the DTO's `answer*` fields), or `null`. */
export function filedAnswerOf(item: Partial<EverWorksFiledInboxItem>): { optionId?: string; text?: string } | null {
	const optionId = item.resolution?.choiceId ?? item.answerOptionId ?? null;
	const text = item.resolution?.text ?? item.answerText ?? null;
	const answer: { optionId?: string; text?: string } = {};
	if (typeof optionId === 'string' && optionId) answer.optionId = optionId;
	if (typeof text === 'string' && text.trim()) answer.text = text.trim();
	return Object.keys(answer).length ? answer : null;
}

/** What Ever Works holds for a filed item, as a snapshot (`sent` fills what its answer leaves out). */
export function filedAsShared(item: Partial<EverWorksFiledInboxItem>, sent: GauzyInboxShared): GauzyInboxShared {
	const choices = Array.isArray(item.choices)
		? item.choices.map((choice) => ({ id: choice.id, label: choice.label }))
		: Array.isArray(item.options)
			? item.options.map((option) => ({ id: option.id, label: option.label }))
			: sent.choices;
	const answer = filedAnswerOf(item);
	return {
		title: typeof item.title === 'string' ? item.title : sent.title,
		body: typeof item.body === 'string' ? item.body : sent.body,
		choices: choices && choices.length ? choices : sent.choices,
		state: filedStateOf(item) ?? 'open',
		resolution: answer ? { ...(answer.optionId ? { choiceId: answer.optionId } : {}), ...(answer.text ? { text: answer.text } : {}) } : null
	};
}

/** The link to the item in the Gauzy web app (the Inbox opens it), or `null` without a configured app URL. */
export function sourceUrlOf(appUrl: string | null | undefined, inboxItemId: string): string | null {
	if (!appUrl) return null;
	return `${appUrl.replace(/\/+$/, '')}/#/pages/inbox?item=${encodeURIComponent(inboxItemId)}`;
}

/** The Gauzy task an item is about: its `taskId`, else its primary link when that is a task. */
export function taskOfItem(item: Pick<IInboxItem, 'taskId' | 'entity' | 'entityId'>): string | null {
	if (item.taskId) return item.taskId as string;
	return item.entity === BaseEntityEnum.Task && item.entityId ? (item.entityId as string) : null;
}

/** The Gauzy goal an item is about (its primary link), or `null`. */
export function goalOfItem(item: Pick<IInboxItem, 'entity' | 'entityId'>): string | null {
	return item.entity === BaseEntityEnum.Goal && item.entityId ? (item.entityId as string) : null;
}

/** Whether a kind of Gauzy item takes a reply (a decision the Ever Works user can make). */
export function takesDecision(kind: InboxItemKindEnum | string): boolean {
	return kind === InboxItemKindEnum.QUESTION || kind === InboxItemKindEnum.APPROVAL || kind === InboxItemKindEnum.ESCALATION;
}
