import { CHAT_MESSAGE_MAX_LENGTH, ChatAppBlockTypeEnum, ChatInteractionStatusEnum, ChatMessageKindEnum, IChatAppBlock, IChatAppButton, IChatMessage } from '@gauzy/contracts';

/**
 * App messages (posted by an incoming webhook): their blocks as the page renders them, and the state of a click on
 * one of their buttons. Pure, so the rules are tested without a component.
 */

const KNOWN_TYPES = new Set<string>(Object.values(ChatAppBlockTypeEnum));

/** The blocks of an app message the page knows how to render (anything else is skipped); none for other messages. */
export function appBlocksOf(message: Pick<IChatMessage, 'kind' | 'blocks'> | null | undefined): IChatAppBlock[] {
	if (!message || message.kind !== ChatMessageKindEnum.APP || !Array.isArray(message.blocks)) return [];
	return message.blocks.filter((block): block is IChatAppBlock => !!block && typeof block === 'object' && KNOWN_TYPES.has(String((block as { type?: unknown }).type)));
}

/**
 * The text the API derives a body from when a post has no `text` (the same rule as the server's `blocksText`): an
 * app message whose body is exactly that shows its blocks only, not the same words twice.
 */
export function blocksText(blocks: readonly IChatAppBlock[]): string {
	const lines: string[] = [];
	for (const block of blocks) {
		if (block.type === ChatAppBlockTypeEnum.HEADER || block.type === ChatAppBlockTypeEnum.TEXT) lines.push(block.text);
		else if (block.type === ChatAppBlockTypeEnum.SECTION) {
			if (block.text) lines.push(block.text);
			if (block.fields?.length) lines.push(block.fields.join('\n'));
		} else if (block.type === ChatAppBlockTypeEnum.CONTEXT) lines.push(block.elements.join(' · '));
	}
	return lines.join('\n').trim();
}

/**
 * The body the API derives from that text: cut to `CHAT_MESSAGE_MAX_LENGTH` with an ellipsis, as the server's `cut`
 * does (a long blocks-only post keeps the start of its text as its body).
 */
export function blocksBody(blocks: readonly IChatAppBlock[]): string {
	const text = blocksText(blocks);
	if (text.length <= CHAT_MESSAGE_MAX_LENGTH) return text;
	return `${text.slice(0, CHAT_MESSAGE_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Whether the body of an app message only repeats its blocks (then the page shows the blocks alone). */
export function bodyRepeatsBlocks(body: string | null | undefined, blocks: readonly IChatAppBlock[]): boolean {
	if (!blocks.length) return false;
	return (body ?? '').trim() === blocksBody(blocks);
}

/** A link a button may open: https only (the API refuses anything else; this is the second lock). */
export function safeButtonUrl(button: Pick<IChatAppButton, 'url'>): string | null {
	const url = typeof button.url === 'string' ? button.url.trim() : '';
	if (!url) return null;
	try {
		return new URL(url).protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

/** An https icon for an app message, or null (then the app's initials show). */
export function safeIconUrl(url: string | null | undefined): string | null {
	return safeButtonUrl({ url: url ?? null });
}

/** The key of one button within one message: its actions block and its action id. */
export function buttonKey(blockId: string | null | undefined, actionId: string): string {
	return JSON.stringify([blockId ?? '', actionId]);
}

/** What a button shows while and after it is clicked. */
export type AppButtonState = 'pending' | 'done' | 'failed';

/** The button state an interaction's status means: retrying stays pending, until it is delivered or failed. */
export function buttonStateOf(status: ChatInteractionStatusEnum | string | null | undefined): AppButtonState {
	if (status === ChatInteractionStatusEnum.DELIVERED) return 'done';
	if (status === ChatInteractionStatusEnum.FAILED) return 'failed';
	return 'pending';
}

/** How often, and how many times, the page asks again about a click whose callback is being retried (60 s: the API retries for about 47 s). */
export const APP_INTERACTION_POLL_MS = 3000;
export const APP_INTERACTION_POLL_MAX = 20;

/**
 * When the page sends a click again whose request got no answer (the network dropped it, a gateway timed out, the API
 * was briefly busy): twice, after 1 s and 3 s, with the click's own idempotency key, so the API takes a click it
 * already had as that click and calls the app no second time.
 */
export const APP_INTERACTION_RETRY_DELAYS_MS: readonly number[] = [1000, 3000];

/**
 * How long one send of a click may take before the page counts it as unanswered and sends it again (same key): the
 * API answers within the app's 5 s callback deadline plus its own work, so a request still open after 15 s hangs.
 */
export const APP_INTERACTION_TIMEOUT_MS = 15_000;

/**
 * Whether a failed click got no answer that settles it: none at all (status 0, the request or its answer was lost), or
 * a timeout, gateway or busy answer. The API may still have taken such a click, so it is sent again with its key.
 */
export function isUnansweredClick(status: number | null | undefined): boolean {
	return !status || status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Whether a failed click keeps its key for the button's next click: one that got no answer, or a server error (the API
 * may have called the app before it failed). A refusal (4xx) settles the click: the next one is a new click.
 */
export function keepsClickKey(status: number | null | undefined): boolean {
	return isUnansweredClick(status) || (status ?? 0) >= 500;
}
