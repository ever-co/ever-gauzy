import * as sanitizeHtml from 'sanitize-html';
import {
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentVisibilityEnum,
	JsonData
} from '@gauzy/contracts';

/**
 * Pure mapping helpers of the legacy import (09-consolidation-migration.md §6/§7).
 *
 * This module is deliberately free of entity/Nest imports so the mapping rules are unit-testable
 * without an application context.
 */

/** The legacy help-center node `privacy` icon string that maps to `PRIVATE` (§6.3). */
export const HELP_CENTER_PRIVATE_ICON = 'eye-off-outline';

/** The canonical empty TipTap editor document (§7 case 4). */
export const EMPTY_TIPTAP_DOC = Object.freeze({
	type: 'doc',
	content: [{ type: 'paragraph' }]
});

/**
 * Returns a fresh (mutable) copy of the canonical empty editor document.
 */
export function emptyTiptapDoc(): JsonData {
	return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/**
 * Maps a legacy help-center *node* `privacy` icon string to a Documents visibility (§6.3):
 * `'eye-off-outline'` → `PRIVATE`; anything else → `ORGANIZATION`.
 *
 * @param privacy The legacy `knowledge_base.privacy` value (an Eva icon string).
 * @returns The mapped visibility.
 */
export function mapNodePrivacyToVisibility(privacy?: string | null): DocumentVisibilityEnum {
	return privacy === HELP_CENTER_PRIVATE_ICON ? DocumentVisibilityEnum.PRIVATE : DocumentVisibilityEnum.ORGANIZATION;
}

/**
 * Maps a legacy help-center *article* boolean `privacy` to a Documents visibility (§6.4):
 * `true` ("only for employees") → `PRIVATE`; `false`/absent → `ORGANIZATION`.
 *
 * @param privacy The legacy `knowledge_base_article.privacy` value.
 * @returns The mapped visibility.
 */
export function mapArticlePrivacyToVisibility(privacy?: boolean | null): DocumentVisibilityEnum {
	return privacy === true ? DocumentVisibilityEnum.PRIVATE : DocumentVisibilityEnum.ORGANIZATION;
}

/**
 * Maps the legacy article `draft` flag to the Documents review pair (§6.4 decision):
 * `draft: true` → `reviewStatus: PENDING` + `reviewReason: 'manual'`; otherwise `NONE`.
 *
 * @param draft The legacy `knowledge_base_article.draft` value.
 * @returns The `{ reviewStatus, reviewReason }` pair to assign.
 */
export function mapDraftToReview(draft?: boolean | null): {
	reviewStatus: DocumentReviewStatusEnum;
	reviewReason: DocumentReviewReasonEnum | null;
} {
	if (draft === true) {
		return {
			reviewStatus: DocumentReviewStatusEnum.PENDING,
			reviewReason: DocumentReviewReasonEnum.MANUAL
		};
	}
	return { reviewStatus: DocumentReviewStatusEnum.NONE, reviewReason: null };
}

/**
 * Resolves a deterministic duplicate-name suffix against the sibling names of the target
 * parent (§7 case 1): `Name`, `Name (2)`, `Name (3)`, … Comparison is case-insensitive
 * (matching how users perceive duplicate names); the returned name preserves original casing.
 *
 * @param name The desired name.
 * @param takenNames The sibling names already present in the target parent.
 * @returns The resolved name and whether a suffix was applied.
 */
export function resolveDuplicateName(name: string, takenNames: Iterable<string>): { name: string; suffixed: boolean } {
	const taken = new Set<string>();
	for (const takenName of takenNames) {
		taken.add(String(takenName).trim().toLowerCase());
	}
	const base = String(name ?? '').trim() || 'Untitled';
	if (!taken.has(base.toLowerCase())) {
		return { name: base, suffixed: false };
	}
	for (let counter = 2; ; counter++) {
		const candidate = `${base} (${counter})`;
		if (!taken.has(candidate.toLowerCase())) {
			return { name: candidate, suffixed: true };
		}
	}
}

/** Extension → MIME map used by the no-byte-read inference of §6.2. */
const EXTENSION_MIME_MAP: Record<string, string> = {
	pdf: 'application/pdf',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	csv: 'text/csv',
	txt: 'text/plain',
	md: 'text/markdown',
	html: 'text/html',
	htm: 'text/html',
	json: 'application/json',
	xml: 'application/xml',
	zip: 'application/zip',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	bmp: 'image/bmp',
	tif: 'image/tiff',
	tiff: 'image/tiff',
	ico: 'image/x-icon',
	heic: 'image/heic',
	avif: 'image/avif'
};

/**
 * Best-effort MIME inference from a storage key / filename extension (§6.2) — no byte read
 * during migration. Unknown extensions return `null` (the M5 backfill job sniffs real bytes).
 *
 * @param keyOrFilename The storage key or original filename.
 * @returns The inferred MIME type, or `null` when unknown.
 */
export function inferMimeTypeFromKey(keyOrFilename?: string | null): string | null {
	if (!keyOrFilename) {
		return null;
	}
	// Strip query strings / fragments a legacy URL may carry, then read the extension.
	const clean = String(keyOrFilename).split(/[?#]/)[0];
	const match = /\.([A-Za-z0-9]{1,10})$/.exec(clean);
	if (!match) {
		return null;
	}
	return EXTENSION_MIME_MAP[match[1].toLowerCase()] ?? null;
}

/**
 * The allowlist the migrated `contentHtml` is held to.
 *
 * Mirrors `RICH_HTML_SANITIZE_OPTIONS` of `@gauzy/core` (`core/html-sanitizer`) — the policy
 * `DocumentService` runs every `contentHtml` write through — so an article that arrives via the
 * legacy import is sanitized exactly like one saved through the API, and re-saving an imported
 * article is a no-op. It is restated here rather than imported because this module is
 * deliberately free of the `@gauzy/core` (Nest + TypeORM) graph so the mapping rules stay
 * unit-testable without an application context; keep the two in step.
 */
const LEGACY_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		// Structural
		'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr',
		// Formatting marks
		'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'code', 'pre', 'mark', 'span',
		// Lists / quotes / links / images
		'ul', 'ol', 'li', 'blockquote', 'a', 'img',
		// Tables
		'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col'
	],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		img: ['src', 'alt', 'width', 'height'],
		ol: ['start'],
		th: ['colspan', 'rowspan'],
		td: ['colspan', 'rowspan'],
		col: ['span'],
		'*': ['style']
	},
	// `style` is allowed as an attribute but restricted to this safe subset of properties.
	allowedStyles: {
		'*': {
			'text-align': [/^(left|right|center|justify)$/],
			color: [/^#[0-9a-f]{3,8}$/i],
			'background-color': [/^#[0-9a-f]{3,8}$/i],
			'font-family': [/^[\w\s,'"-]+$/]
		}
	},
	// Link schemes: http/https/mailto/tel only (no javascript:, no data:, no vbscript:).
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	// Image sources: http/https only — no data:, no blob:.
	allowedSchemesByTag: { img: ['https', 'http'] },
	disallowedTagsMode: 'discard',
	// Force rel="noopener noreferrer" on every link (tab-nabbing hardening).
	transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) }
};

/**
 * Server-side sanitization of migrated legacy content. The canonical content remains
 * `contentJson`; this guards the `contentHtml` fidelity copy, which is re-rendered with
 * `[innerHTML]`.
 *
 * 🛑 Parser-backed **allowlist**, never a denylist of regexes. This used to be a chain of
 * `.replace()` calls (strip `<script|style|iframe|object|embed>` blocks, then their opening
 * tags, then ` on*=` handlers, then `javascript:` URLs) and every one of those passes was
 * bypassable — legacy HTML comes from an untrusted export, so all of these were reachable:
 *
 * - **A removal spliced a new tag together.** `<scr<style>ipt>alert(1)</script>` has no
 *   `</style>`, so the block pass did nothing; the opening-tag pass then deleted `<style>`,
 *   joining `<scr` to `ipt>` — the function *emitted* `<script>alert(1)</script>`. Each pass
 *   edits the string the next one reads, and a `g` flag does not help: the cursor has already
 *   moved past the splice point. (CodeQL `js/incomplete-multi-character-sanitization`.)
 * - **`/` separates attributes too.** ` on\w+=` required leading whitespace, so
 *   `<img src=x/onerror=alert(1)>` kept its handler.
 * - **Browsers decode entities before resolving a URL.** `href="&#106;avascript:alert(1)"`
 *   and `href="jav&Tab;ascript:alert(1)"` never matched the literal `javascript:` the regex
 *   compared against.
 * - **The denylist only listed what someone thought of.** `data:text/html`, `vbscript:`,
 *   `<svg><animate onbegin=…>`, `<form>`/`<input>` were all passed straight through.
 *
 * A parser sees the same tags, attributes and URLs the browser will, so none of the above
 * survives; an allowlist additionally fails closed on constructs nobody enumerated.
 *
 * @param html The raw legacy HTML.
 * @returns The sanitized HTML.
 */
export function sanitizeLegacyHtml(html: string): string {
	const raw = String(html ?? '');
	if (!raw) {
		return '';
	}
	return sanitizeHtml(raw, LEGACY_HTML_SANITIZE_OPTIONS);
}

/**
 * Replaces every `<…>` tag with a single space, leaving an unterminated trailing `<` as
 * literal text — exactly what `/<[^>]*>/g` did.
 *
 * Hand-rolled because no regex can do this in linear time: `<[^>]*>` rescans the remainder
 * of the input from every `<` that has no closing `>`, so 80 KB of `<` cost ~5s locally, and
 * making the run atomic with `<(?=([^>]*))\1>` does not help — the lookahead still scans from
 * each `<`. Legacy HTML arrives from an untrusted export, so the walk below keeps both
 * cursors moving forward only, visiting each character at most once.
 */
function replaceTagsWithSpace(html: string): string {
	let result = '';
	let cursor = 0;
	for (;;) {
		const open = html.indexOf('<', cursor);
		if (open === -1) return result + html.slice(cursor);

		const close = html.indexOf('>', open + 1);
		if (close === -1) return result + html.slice(cursor);

		result += html.slice(cursor, open) + ' ';
		cursor = close + 1;
	}
}

/**
 * True when the given legacy HTML carries no visible content (empty-article detection,
 * §7 case 4): tags stripped, entities like `&nbsp;` collapsed, whitespace trimmed.
 *
 * @param html The legacy HTML (may be null/undefined).
 * @returns Whether the content is effectively empty.
 */
export function isEmptyHtml(html?: string | null): boolean {
	if (html === null || html === undefined) {
		return true;
	}
	const text = replaceTagsWithSpace(String(html))
		.replace(/&(nbsp|#160|#xa0);/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length === 0;
}

/**
 * Parses a possibly-serialized JSON column value (SQLite stores `jsonb`-shorthand columns as
 * text). Returns `null` for unparseable or empty values.
 *
 * @param value The raw column value.
 * @returns The parsed object, or `null`.
 */
export function parseJsonColumn(value: unknown): JsonData | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === 'object') {
		return value as JsonData;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}
		try {
			const parsed = JSON.parse(trimmed);
			return typeof parsed === 'object' && parsed !== null ? (parsed as JsonData) : null;
		} catch {
			return null;
		}
	}
	return null;
}
