// cspell:ignore functioncall
/**
 * Hide tool calls a model WROTE OUT as text instead of making them.
 *
 * Some models, now and then, print the call they meant to make — the bare arguments of a canvas
 * tool (`{"path": "/pages/…"}`), a `{"name": "open_page", "arguments": …}` envelope, a
 * `<tool_call>…</tool_call>` block, an `<input>{…}</input>` tag — and stray `|` characters around
 * it then render as an empty markdown table. `<input>` is the worst of them: the markdown renderer
 * keeps it as a disabled checkbox, so the reader saw a grey box inside an empty table cell. None of
 * that is meant for the reader, and the tool steps above and below the text already show what
 * actually ran. Display-only: the stored message is never altered, and code — fenced blocks and
 * inline `code` spans — is left untouched. JSON that is an ANSWER (`{"total": 19}`) stays: a
 * standalone object is only removed when it has the shape of a tool call.
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
const MASK_CHAR = '\uE000';
const MASK = new RegExp(`${MASK_CHAR}(\\d+)${MASK_CHAR}`, 'g');

/** A code fence opener: up to three spaces, then three or more backticks or tildes (CommonMark). */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
/** A code fence closer: the same, followed by nothing but whitespace. */
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** A line of nothing but table punctuation: `|`, `|-|`, `| :--- |`. */
const PIPE_ONLY = /^[\s|:-]*$/;

/** `text` parsed as a plain JSON object, or `null` when it is not one. */
function parseJsonObject(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
	try {
		const parsed = JSON.parse(trimmed);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** A tool name as models write it: snake_case with at least one underscore (`open_page`). */
const TOOL_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;
/** Envelope keys that name the tool, and keys that carry its arguments. */
const NAME_KEYS = ['name', 'tool', 'tool_name', 'toolName', 'function'];
const ARGUMENT_KEYS = ['arguments', 'args', 'input', 'parameters', 'params'];

/** Keys an envelope may carry besides its name and arguments: an id, and the provider's `type`. */
const ENVELOPE_EXTRA_KEYS = ['id', 'type'];
/** The `type` values providers put on a call envelope. */
const ENVELOPE_TYPES = ['function', 'tool_use', 'tool_call'];

/** Every key of `value` is one of `allowed`. */
function onlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
	return Object.keys(value).every((key) => allowed.includes(key));
}

/** Tool arguments as models write them: an object, or (OpenAI style) a JSON string holding one. */
function isArgumentsValue(value: unknown): boolean {
	if (value && typeof value === 'object' && !Array.isArray(value)) return true;
	return typeof value === 'string' && parseJsonObject(value) !== null;
}

/** `fill_form`'s `fields`: a non-empty list of `{ field, value }` pairs. */
function isFormFields(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((item) => !!item && typeof item === 'object' && !Array.isArray(item) && 'field' in item)
	);
}

/**
 * Does this object look like a tool call rather than data? Only these shapes count:
 * - an envelope: a snake_case tool name plus its arguments (an object, or a JSON string of one) and
 *   nothing else but an id or a provider `type` — `{"name": "open_page", "arguments": {…}}`, also
 *   wrapped as `{"function": {…}}`;
 * - the canvas tools' own arguments — `{"path": "/pages/…"}` (open_page, optionally with
 *   `queryParams`; every in-app route lives under `/pages`), `{"fields": [{"field": …}]}`
 *   (fill_form), `{"formIndex": 0}` (submit_form).
 * Anything else is an answer and stays: `{"total": 19}`, `{"name": "Alice", "input": "…"}`, a field
 * definition `{"name": "first_name", "type": "string", "input": "text"}`, `{"path": "/api/tasks"}`,
 * `{"fields": ["title", "dueDate"]}`.
 */
export function isToolCallShape(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	const nested = keys.length === 1 ? value[keys[0]] : undefined;
	if (
		['function', 'tool_call', 'toolCall'].includes(keys[0]) &&
		nested &&
		typeof nested === 'object' &&
		!Array.isArray(nested)
	) {
		return isToolCallShape(nested as Record<string, unknown>);
	}
	const nameKey = NAME_KEYS.find((key) => typeof value[key] === 'string' && TOOL_NAME.test(value[key] as string));
	const argumentKey = ARGUMENT_KEYS.find((key) => key in value);
	const type = value['type'];
	if (
		nameKey &&
		argumentKey &&
		isArgumentsValue(value[argumentKey]) &&
		onlyKeys(value, [...NAME_KEYS, ...ARGUMENT_KEYS, ...ENVELOPE_EXTRA_KEYS]) &&
		(type === undefined || (typeof type === 'string' && ENVELOPE_TYPES.includes(type)))
	) {
		return true;
	}
	if (typeof value['path'] === 'string' && /^\/pages(\/|$)/.test(value['path'] as string)) {
		return onlyKeys(value, ['path', 'queryParams']);
	}
	if (isFormFields(value['fields'])) return onlyKeys(value, ['fields', 'formIndex']);
	if (typeof value['formIndex'] === 'number') return onlyKeys(value, ['formIndex']);
	return false;
}

/** The opening of a tool-call object still being streamed — its first key gives it away. */
const PARTIAL_CALL = /^\{\s*"(name|tool|tool_name|toolName|function|tool_call|toolCall|path|fields|formIndex)"/;

/**
 * A line with its table pipes taken off, as a JSON candidate. Backticks are NOT taken off: JSON in
 * inline code is being shown on purpose.
 */
function unwrapLine(line: string): string {
	return line
		.trim()
		.replace(/^\|+|\|+$/g, '')
		.trim();
}

/**
 * The line on which the object opening at `lines[start]` closes — braces counted outside JSON
 * strings — or -1 when the text ends first. There is no line limit: an answer of any length is
 * found whole, so the lines inside it are never mistaken for calls of their own.
 */
function findObjectEnd(lines: string[], start: number): number {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < lines.length; index++) {
		for (const char of unwrapLine(lines[index])) {
			if (inString) {
				if (escaped) escaped = false;
				else if (char === '\\') escaped = true;
				else if (char === '"') inString = false;
			} else if (char === '"') {
				inString = true;
			} else if (char === '{') {
				depth++;
			} else if (char === '}' && --depth === 0) {
				return index;
			}
		}
	}
	return -1;
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

		// A JSON object on its own line(s) shaped like a tool call — one that was never made.
		if (candidate.startsWith('{')) {
			const end = findObjectEnd(lines, index);
			if (end === -1) {
				// Never closed: still arriving, or not JSON at all. A call being written is hidden
				// rather than flashed; anything else is kept as it is, and its inner lines are not
				// re-scanned as calls of their own.
				if (!(isStreaming && PARTIAL_CALL.test(candidate))) kept.push(...lines.slice(index));
				break;
			}
			// The whole block is one unit: a call is dropped entirely, everything else (an answer,
			// braces in prose) kept entirely — never re-scanned line by line, or a call-shaped VALUE
			// inside an answer (`{"example": {"path": "/pages/tasks"}}`) would be cut out of it.
			const parsed = parseJsonObject(lines.slice(index, end + 1).map(unwrapLine).join('\n'));
			if (!parsed || !isToolCallShape(parsed)) kept.push(...lines.slice(index, end + 1));
			index = end;
			continue;
		}
		kept.push(lines[index]);
	}

	// Table debris: a pipe-only line is a real separator only when a row with content sits next to it.
	// The runs of blank lines a removal leaves behind are collapsed here, in prose only.
	return kept
		.filter((line, index) => {
			if (!line.includes('|') || !PIPE_ONLY.test(line)) return true;
			const neighbours = [kept[index - 1], kept[index + 1]].filter((neighbour) => neighbour !== undefined);
			return neighbours.some((neighbour) => neighbour.includes('|') && hasContent(neighbour));
		})
		.join('\n')
		.replace(/\n{3,}/g, '\n\n');
}

/**
 * The assistant text with any tool call written out as text removed. Fenced code blocks pass
 * through byte for byte; runs of blank lines left behind in prose are collapsed.
 *
 * @param text - An assistant text part.
 * @param isStreaming - True while the part is still arriving: a half-written call is hidden too.
 */
export function stripLeakedToolCalls(text: string, isStreaming = false): string {
	if (!text) return text;

	// Split into prose and fenced-code runs; only prose is cleaned. A block closes only on a fence
	// of the SAME character, at least as long as the one that opened it, with nothing after it but
	// whitespace — so a ``` line inside a ```` block is content, not the end of the block.
	const runs: { code: boolean; text: string }[] = [];
	let current: string[] = [];
	let fence: string | null = null;
	for (const line of text.split('\n')) {
		if (fence === null) {
			const open = FENCE_OPEN.exec(line);
			if (open) {
				if (current.length) runs.push({ code: false, text: current.join('\n') });
				current = [line];
				fence = open[1];
				continue;
			}
		} else {
			const close = FENCE_CLOSE.exec(line);
			if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
				current.push(line);
				runs.push({ code: true, text: current.join('\n') });
				current = [];
				fence = null;
				continue;
			}
		}
		current.push(line);
	}
	if (current.length) runs.push({ code: fence !== null, text: current.join('\n') });

	const lastProse = runs.map((run) => !run.code).lastIndexOf(true);
	return runs
		.map((run, index) => (run.code ? run.text : cleanProse(run.text, isStreaming && index === lastProse)))
		.join('\n')
		.trim();
}
