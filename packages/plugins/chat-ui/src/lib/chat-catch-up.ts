import { IChatMessage, IChatMessagePage, IChatMessageWithRelations } from '@gauzy/contracts';
import { mergeMessages } from './chat-ui.helpers';

/** How the API orders messages: by creation time, then by id. */
function compare(a: Pick<IChatMessage, 'createdAt' | 'id'>, b: Pick<IChatMessage, 'createdAt' | 'id'>): number {
	return new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime() || String(a.id).localeCompare(String(b.id));
}

/** What the loaded list becomes after the newest page was read again (a catch-up). */
export interface CatchUpResult<T extends IChatMessage> {
	messages: T[];
	/** The messages the page added (written while the stream was down). */
	added: T[];
	/** Whether the page replaced the list (it no longer reaches the last loaded message: more was written than a page holds). */
	replaced: boolean;
}

/**
 * The loaded messages reconciled with the newest page read again after a gap: within the page's span (from its first
 * message on, or everything when the conversation has nothing before it) the page is the truth — a message it holds
 * replaces ours (an edit, a reaction, a pin, a reply count), one it does not hold was deleted and leaves; the older
 * loaded messages stay as they are. Only a page that shares no message with the loaded ones (more was written than a
 * page holds) replaces the list: the last loaded message may simply have been deleted.
 */
export function reconcileWithNewest<T extends IChatMessage>(loaded: readonly T[], page: Pick<IChatMessagePage, 'hasBefore'> & { messages: readonly T[] }): CatchUpResult<T> {
	const pageById = new Map(page.messages.map((message) => [String(message.id), message]));
	const overlaps = loaded.some((message) => pageById.has(String(message.id)));
	// Nothing in common: the page starts after the loaded range, unless nothing comes before it (then it is all).
	if (!loaded.length || (!overlaps && page.hasBefore)) {
		return { messages: mergeMessages([], page.messages), added: [...page.messages], replaced: true };
	}
	const first = page.messages[0];
	const inSpan = (message: T) => !page.hasBefore || (!!first && compare(message, first) >= 0);
	const kept = loaded.filter((message) => !inSpan(message) || pageById.has(String(message.id))).map((message) => pageById.get(String(message.id)) ?? message);
	const loadedIds = new Set(loaded.map((message) => String(message.id)));
	const added = page.messages.filter((message) => !loadedIds.has(String(message.id)));
	return { messages: mergeMessages(kept, added), added, replaced: false };
}

/**
 * The loaded replies of a thread reconciled with its first page read again after a gap (replies run oldest first):
 * up to the page's last reply (or everything when nothing follows it) the page is the truth — a reply it holds
 * replaces ours, one it does not hold was deleted and leaves; loaded replies after its span stay. `beyond` says
 * whether such replies were kept (then what follows the loaded ones is still to be read from the last of them).
 */
export function reconcileWithOldest<T extends IChatMessage>(
	loaded: readonly T[],
	page: Pick<IChatMessagePage, 'hasAfter'> & { messages: readonly T[] }
): { messages: T[]; added: T[]; beyond: boolean } {
	const pageById = new Map(page.messages.map((message) => [String(message.id), message]));
	const lastOfPage = page.messages[page.messages.length - 1];
	const inSpan = (message: T) => !page.hasAfter || (!!lastOfPage && compare(message, lastOfPage) <= 0);
	const kept = loaded.filter((message) => !inSpan(message) || pageById.has(String(message.id))).map((message) => pageById.get(String(message.id)) ?? message);
	const loadedIds = new Set(loaded.map((message) => String(message.id)));
	const added = page.messages.filter((message) => !loadedIds.has(String(message.id)));
	return { messages: mergeMessages(kept, added), added, beyond: loaded.some((message) => !inSpan(message)) };
}

/**
 * A catch-up's answer applied to the list as it is now, not as it was when the read began: the messages loaded then
 * are reconciled against the whole page (`reconcile`, so its span stays where the API put it); messages shown since
 * (a live event, my own send) and messages changed here since (`touched`: refreshed, deleted, my own action) keep
 * their current state, whatever the page says of them.
 *
 * @returns What `reconcile` answered, with the list to show and the added messages nobody changed meanwhile.
 */
export function applyCatchUp<T extends IChatMessage, R extends { messages: T[]; added: T[] }>(
	current: readonly T[],
	before: ReadonlySet<string>,
	touched: ReadonlySet<string>,
	reconcile: (loaded: readonly T[]) => R
): R {
	const untouched = (message: T) => !touched.has(String(message.id));
	const kept = current.filter((message) => !before.has(String(message.id)) || !untouched(message));
	const result = reconcile(current.filter((message) => before.has(String(message.id))));
	return { ...result, messages: mergeMessages(result.messages.filter(untouched), kept), added: result.added.filter(untouched) };
}

/**
 * The root a catch-up read, with the fields my own actions changed meanwhile on top: the follow state as I set it, and
 * the reply count and last reply never behind what my own reply made them (the read may predate it, or count more).
 */
export function rootWithMyFields(root: IChatMessageWithRelations, mine: Partial<IChatMessageWithRelations>): IChatMessageWithRelations {
	const next: IChatMessageWithRelations = { ...root, ...mine };
	if (mine.replyCount !== undefined) next.replyCount = Math.max(root.replyCount ?? 0, mine.replyCount);
	if (mine.lastReplyAt && root.lastReplyAt) {
		next.lastReplyAt = new Date(mine.lastReplyAt).getTime() >= new Date(root.lastReplyAt).getTime() ? mine.lastReplyAt : root.lastReplyAt;
	}
	return next;
}
