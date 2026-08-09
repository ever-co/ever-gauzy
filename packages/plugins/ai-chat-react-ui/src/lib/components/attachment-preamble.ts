/**
 * The attachment preamble: how staged attachments travel inside the user's message text,
 * and how the transcript UI recognizes them again to render chips instead of raw lines.
 *
 * Attachments ride as ordinary message TEXT on purpose. The tool surface the assistant has is
 * `docs_read(documentId)` / `docs_search(query)`, so naming the ids in the message is precisely
 * what makes an attachment actionable — and because the text is part of the message history, the
 * attachment context survives every later turn and conversation reload with zero extra plumbing.
 * A side channel the model never sees (metadata, data parts) would be decoration: AI SDK data
 * parts are not model-visible in converted history.
 *
 * The cost of that mechanism is that the raw preamble would show inside the user's own bubble.
 * {@link parseAttachmentPreamble} is the display-side answer: the transcript recognizes the exact
 * format {@link buildAttachmentPreamble} emits (plus the legacy wording earlier builds produced)
 * and renders chips + the user's own words. Parsing only ever affects DISPLAY — the model always
 * sees the full text — so a user hand-typing something preamble-shaped merely gets it rendered
 * as chips, which is harmless.
 */

/** One attachment staged on the next message. */
export interface IStagedAttachment {
	/** Set when the document exists in Documents — the handle `docs_read` takes. */
	documentId?: string;
	/** Display name, and the only handle an attachment has when Documents is unavailable. */
	name: string;
}

/** First line of every preamble. EXACT — parsing keys on it, and old history carries it. */
const PREAMBLE_HEADER = 'Attached documents for this message:';

/**
 * Build the preamble for the staged attachments.
 *
 * Two line shapes:
 * - With an id — the document is in Documents (picked from the library, or uploaded id-first):
 *   the assistant is told to read exactly that document. `docs_read` itself explains the
 *   still-processing state for a fresh upload, so no hedging is needed here.
 * - Without an id — Documents is unavailable on this install (the id-first upload fell back to
 *   plain chat storage), which also means the `docs_*` tools are not registered. The line only
 *   STATES the attachment; earlier builds told the assistant to `docs_search` for it, which
 *   could never succeed — chat-captured documents are not auto-indexed, and on fallback
 *   installs the tool does not even exist.
 *
 * @param attachments The staged attachments.
 * @returns The preamble, or an empty string when nothing is attached.
 */
export function buildAttachmentPreamble(attachments: IStagedAttachment[]): string {
	if (!attachments.length) {
		return '';
	}
	const lines = attachments.map((attachment) =>
		attachment.documentId
			? `- "${attachment.name}" (document id: ${attachment.documentId}) — read it with docs_read.`
			: `- "${attachment.name}" — attached to this conversation.`
	);
	return [PREAMBLE_HEADER, ...lines].join('\n');
}

/** What {@link parseAttachmentPreamble} recovers from a message's text. */
export interface IParsedAttachmentPreamble {
	/** The attachments named by the preamble, in order. */
	attachments: IStagedAttachment[];
	/** The user's own message text, with the preamble removed. May be empty. */
	text: string;
}

/**
 * Attachment line, both shapes. Name first (greedy, so embedded quotes survive), then the
 * optional `(document id: …)` suffix, then the em-dash instruction — which is deliberately
 * unanchored beyond its shape: it differs between the current and legacy builders, and pinning
 * the wording would silently stop old history from rendering as chips.
 */
const ID_LINE = /^- "(.+)" \(document id: ([0-9a-fA-F-]{36})\) — .+$/;
const NAME_LINE = /^- "(.+)" — .+$/;

/**
 * Recognize a message that starts with an attachment preamble.
 *
 * Strict on the load-bearing parts (exact header as the FIRST line, at least one attachment
 * line immediately after) and tolerant on the instruction wording, so both current and legacy
 * messages parse. Returns `null` for anything else — the caller then renders the text as-is.
 *
 * @param messageText The full text of a user message part.
 * @returns The parsed attachments + remaining user text, or `null` when there is no preamble.
 */
export function parseAttachmentPreamble(messageText: string): IParsedAttachmentPreamble | null {
	if (!messageText.startsWith(PREAMBLE_HEADER + '\n')) {
		return null;
	}
	const lines = messageText.split('\n');
	const attachments: IStagedAttachment[] = [];
	let index = 1;
	for (; index < lines.length; index++) {
		const line = lines[index];
		const withId = ID_LINE.exec(line);
		if (withId) {
			attachments.push({ name: withId[1], documentId: withId[2] });
			continue;
		}
		const nameOnly = NAME_LINE.exec(line);
		if (nameOnly) {
			attachments.push({ name: nameOnly[1] });
			continue;
		}
		break;
	}
	if (!attachments.length) {
		return null;
	}
	// The builder joins preamble and user text with a blank line; strip that one separator but
	// preserve any further leading whitespace the user typed themselves.
	let rest = lines.slice(index).join('\n');
	if (rest.startsWith('\n')) {
		rest = rest.slice(1);
	}
	return { attachments, text: rest };
}
