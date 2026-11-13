/** A web link of a message, as its card shows it: where it leads, without anything fetched from there. */
export interface ChatLinkCard {
	/** The link as written (`http` or `https` only). */
	url: string;
	/** The host, without `www.`. */
	host: string;
	/** The path, query and fragment, shortened; empty for a site's home. */
	path: string;
}

/** The most link cards one message shows. */
export const CHAT_LINK_CARDS_MAX = 3;

/** A path longer than this is shortened in the card. */
const PATH_MAX = 60;

/** Code (fenced and inline) is shown as written: a URL inside it gets no card. */
const CODE = /```[\s\S]*?```|`[^`\n]*`/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>[\]{}"'`]+/gi;
/** Punctuation that ends a sentence rather than the link. */
const TRAILING = /[.,;:!?*_~]+$/;
/**
 * A task link, as the platform reads one into a task card (`chat-task-references.ts` of the chat plugin): a task page
 * of a client (`/task/<id>`, `/tasks/<id>`, `/tasks/view/<id>`, in the path or the hash route) or a `taskId=` query.
 */
const TASK_LINK = /(?:\/tasks?\/(?:view\/)?|[?&]taskId=)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-f-])/i;

/**
 * A link as written, without what closes the sentence around it: trailing punctuation, and closing parentheses it does
 * not open itself (`[guide](https://example.com/guide)`, `(see https://example.com)`), while a URL's own balanced
 * ones stay (`https://en.wikipedia.org/wiki/Function_(mathematics)`).
 */
export function withoutUnbalancedEnd(raw: string): string {
	let url = raw.replace(TRAILING, '');
	while (url.endsWith(')') && (url.match(/\)/g) ?? []).length > (url.match(/\(/g) ?? []).length) {
		url = url.slice(0, -1).replace(TRAILING, '');
	}
	return url;
}

/**
 * The web links of a message body that get a card, in the order written, each once, a few at most. The card is
 * made from the link, and shows the page's title and text once the platform has fetched a preview of it
 * (`ChatLinkPreviewsService`). The reader's browser never fetches anything from the linked site, so a link cannot learn
 * who read it.
 *
 * Left out: links inside code, links that are not `http(s)`, task links (the message shows the task's card
 * instead), and anything that does not parse as a URL.
 */
export function linkCardsOf(body: string, limit = CHAT_LINK_CARDS_MAX): ChatLinkCard[] {
	const text = (body ?? '').replace(CODE, ' ');
	const cards: ChatLinkCard[] = [];
	const seen = new Set<string>();
	for (const match of text.matchAll(URL_PATTERN)) {
		if (cards.length >= limit) break;
		const raw = withoutUnbalancedEnd(match[0]);
		let url: URL;
		try {
			url = new URL(raw);
		} catch {
			continue;
		}
		if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) continue;
		if (TASK_LINK.test(url.href)) continue;
		const key = url.href;
		if (seen.has(key)) continue;
		seen.add(key);
		const rest = `${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`;
		cards.push({
			url: url.href,
			host: url.hostname.replace(/^www\./i, ''),
			path: rest.length > PATH_MAX ? `${rest.slice(0, PATH_MAX - 1)}…` : rest
		});
	}
	return cards;
}
