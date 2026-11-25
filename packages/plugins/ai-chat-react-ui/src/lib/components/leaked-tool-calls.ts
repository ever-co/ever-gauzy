/**
 * Hide tool calls a model WROTE OUT as text instead of making them.
 *
 * Some models, now and then, print the call they meant to make — a bare `{"path": "…"}`, a
 * `<tool_call>…</tool_call>` block, an `<input>{…}</input>` tag — and stray `|` characters around
 * it then render as an empty markdown table. `<input>` is the worst of them: the markdown renderer
 * keeps it as a disabled checkbox, so the reader saw a grey box inside an empty table cell. None of
 * that is meant for the reader, and the tool steps above and below the text already show what
 * actually ran. Display-only: the stored message is never altered, and code — fenced blocks and
 * inline `code` spans — is left untouched.
 */

/** Wrapper tags models use around a tool call written as text. */
const WRAPPER_TAGS = [
	'tool_call',
	'tool_calls',
	'tool_use',
	'tool_code',
	'function_call',
	'function_calls',
	'functioncall',
	'invoke',
	'parameter',
	'tool',
	'tools',
	'function',
	'call',
	'input',
	'arguments',
	'args'
];

/** A wrapper tag name, or any snake_case name — tool names are snake_case, HTML tag names never are. */
const TAG_NAME = `(?:${WRAPPER_TAGS.join('|')}|[a-z][a-z0-9]*_[a-z0-9_]+)`;

/** A complete `<tag …>…</tag>` block (non-greedy, across lines). */
const TAG_BLOCK = new RegExp(`<(${TAG_NAME})\\b[^>\\n]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
/** An opening tag that is never closed — the rest of the text is the call still being written. */
const UNCLOSED_TAG = new RegExp(`<(${TAG_NAME})\\b[^>\\n]*>(?![\\s\\S]*<\\/\\1\\s*>)[\\s\\S]*$`, 'i');
/** A lone opening, closing or self-closing tag left over. */
const STRAY_TAG = new RegExp(`<\\/?${TAG_NAME}\\b[^>\\n]*\\/?>`, 'gi');

/** Inline `code` spans — a tag written there is being shown, not leaked. */
const INLINE_CODE = /`+[^`\n]*`+/g;
/** Placeholder for a masked inline code span (a private-use character never seen in model text). */
const MASK_CHAR = '';
const MASK = new RegExp(`${MASK_CHAR}(\\d+)${MASK_CHAR}`, 'g');

/** A code fence opener / closer. */
const FENCE = /^\s*(```|~~~)/;
/** A line of nothing but table punctuation: `|`, `|-|`, `| :--- |`. */
const PIPE_ONLY = /^[\s|:-]*$/;

/** True when `text` parses as a plain JSON object. */
function isJsonObject(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
	try {
		const parsed = JSON.parse(trimmed);
		return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
	} catch {
		return false;
	}
}

/** A line with its table pipes and inline-code ticks taken off, as a JSON candidate. */
function unwrapLine(line: string): string {
	return line
		.trim()
		.replace(/^\|+|\|+$/g, '')
		.trim()
		.replace(/^`+|`+$/g, '')
		.trim();
}

/** Has words or numbers in it — a real table row, unlike pipe-only debris. */
function hasContent(line: string): boolean {
	return /[\p{L}\p{N}]/u.test(line);
}

/** Remove call tags from prose, leaving inline code spans exactly as they were. */
function stripTags(text: string, isStreaming: boolean): string {
	const spans: string[] = [];
	let masked = text.replace(INLINE_CODE, (span) => `${MASK_CHAR}${spans.push(span) - 1}${MASK_CHAR}`);
	masked = masked.replace(TAG_BLOCK, '');
	// Only while streaming: the closing tag may simply not have arrived yet. In a finished reply an
	// unclosed tag (`<input>` is often written without one) loses just the tag, never the text after.
	if (isStreaming) masked = masked.replace(UNCLOSED_TAG, '');
	masked = masked.replace(STRAY_TAG, '');
	return masked.replace(MASK, (_match, index: string) => spans[Number(index)]);
}

/** Clean one run of text that sits OUTSIDE code fences. */
function cleanProse(text: string, isStreaming: boolean): string {
	const lines = stripTags(text, isStreaming).split('\n');
	const kept: string[] = [];
	for (let index = 0; index < lines.length; index++) {
		const candidate = unwrapLine(lines[index]);

		// A JSON object on its own line(s) — the arguments of a call that was never made.
		if (candidate.startsWith('{')) {
			let joined = candidate;
			let end = index;
			while (!isJsonObject(joined) && end + 1 < lines.length && end - index < 20) {
				end++;
				joined += '\n' + unwrapLine(lines[end]);
			}
			if (isJsonObject(joined)) {
				index = end;
				continue;
			}
			// Still arriving: hide the half-written object rather than flash it.
			if (isStreaming && end === lines.length - 1 && /^\{\s*"/.test(candidate)) break;
		}
		kept.push(lines[index]);
	}

	// Table debris: a pipe-only line is a real separator only when a row with content sits next to it.
	return kept
		.filter((line, index) => {
			if (!line.includes('|') || !PIPE_ONLY.test(line)) return true;
			const neighbours = [kept[index - 1], kept[index + 1]].filter((neighbour) => neighbour !== undefined);
			return neighbours.some((neighbour) => neighbour.includes('|') && hasContent(neighbour));
		})
		.join('\n');
}

/**
 * The assistant text with any tool call written out as text removed. Fenced code blocks pass
 * through unchanged; runs of blank lines left behind are collapsed.
 *
 * @param text - An assistant text part.
 * @param isStreaming - True while the part is still arriving: a half-written call is hidden too.
 */
export function stripLeakedToolCalls(text: string, isStreaming = false): string {
	if (!text) return text;

	// Split into prose and fenced-code runs; only prose is cleaned.
	const runs: { code: boolean; text: string }[] = [];
	let current: string[] = [];
	let inFence = false;
	for (const line of text.split('\n')) {
		if (FENCE.test(line)) {
			if (!inFence) {
				if (current.length) runs.push({ code: false, text: current.join('\n') });
				current = [line];
				inFence = true;
			} else {
				current.push(line);
				runs.push({ code: true, text: current.join('\n') });
				current = [];
				inFence = false;
			}
			continue;
		}
		current.push(line);
	}
	if (current.length) runs.push({ code: inFence, text: current.join('\n') });

	const lastProse = runs.map((run) => !run.code).lastIndexOf(true);
	return runs
		.map((run, index) => (run.code ? run.text : cleanProse(run.text, isStreaming && index === lastProse)))
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
