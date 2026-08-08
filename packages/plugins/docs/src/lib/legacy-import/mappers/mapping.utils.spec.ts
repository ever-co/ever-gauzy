import { DocumentReviewReasonEnum, DocumentReviewStatusEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import {
	inferMimeTypeFromKey,
	isEmptyHtml,
	mapArticlePrivacyToVisibility,
	mapDraftToReview,
	mapNodePrivacyToVisibility,
	parseJsonColumn,
	resolveDuplicateName,
	sanitizeLegacyHtml
} from './mapping.utils';

describe('legacy-import mapping utils', () => {
	describe('mapNodePrivacyToVisibility (09 §6.3)', () => {
		it('maps the private eva icon to PRIVATE', () => {
			expect(mapNodePrivacyToVisibility('eye-off-outline')).toBe(DocumentVisibilityEnum.PRIVATE);
		});

		it('maps every other value — including null/undefined — to ORGANIZATION', () => {
			expect(mapNodePrivacyToVisibility('eye-outline')).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapNodePrivacyToVisibility('')).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapNodePrivacyToVisibility(null)).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapNodePrivacyToVisibility(undefined)).toBe(DocumentVisibilityEnum.ORGANIZATION);
		});

		it('never maps the exposing direction by accident (unknown strings stay ORGANIZATION)', () => {
			expect(mapNodePrivacyToVisibility('EYE-OFF-OUTLINE')).toBe(DocumentVisibilityEnum.ORGANIZATION);
		});
	});

	describe('mapArticlePrivacyToVisibility (09 §6.4)', () => {
		it('maps privacy: true ("only for employees") to PRIVATE', () => {
			expect(mapArticlePrivacyToVisibility(true)).toBe(DocumentVisibilityEnum.PRIVATE);
		});

		it('maps false / null / undefined to ORGANIZATION', () => {
			expect(mapArticlePrivacyToVisibility(false)).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapArticlePrivacyToVisibility(null)).toBe(DocumentVisibilityEnum.ORGANIZATION);
			expect(mapArticlePrivacyToVisibility(undefined)).toBe(DocumentVisibilityEnum.ORGANIZATION);
		});
	});

	describe('mapDraftToReview (09 §6.4 decision)', () => {
		it('routes drafts into the review queue with reason manual', () => {
			expect(mapDraftToReview(true)).toEqual({
				reviewStatus: DocumentReviewStatusEnum.PENDING,
				reviewReason: DocumentReviewReasonEnum.MANUAL
			});
		});

		it('leaves published articles unflagged', () => {
			expect(mapDraftToReview(false)).toEqual({
				reviewStatus: DocumentReviewStatusEnum.NONE,
				reviewReason: null
			});
			expect(mapDraftToReview(null)).toEqual({
				reviewStatus: DocumentReviewStatusEnum.NONE,
				reviewReason: null
			});
		});
	});

	describe('resolveDuplicateName (09 §7 case 1)', () => {
		it('keeps the original name when no sibling holds it', () => {
			expect(resolveDuplicateName('Handbook', ['Policies'])).toEqual({ name: 'Handbook', suffixed: false });
		});

		it('suffixes deterministically from (2) upwards', () => {
			expect(resolveDuplicateName('Handbook', ['Handbook'])).toEqual({ name: 'Handbook (2)', suffixed: true });
			expect(resolveDuplicateName('Handbook', ['Handbook', 'Handbook (2)'])).toEqual({
				name: 'Handbook (3)',
				suffixed: true
			});
			expect(resolveDuplicateName('Handbook', ['Handbook', 'Handbook (2)', 'Handbook (3)'])).toEqual({
				name: 'Handbook (4)',
				suffixed: true
			});
		});

		it('compares case-insensitively but preserves the original casing', () => {
			expect(resolveDuplicateName('HandBook', ['handbook'])).toEqual({ name: 'HandBook (2)', suffixed: true });
		});

		it('trims the desired name and falls back to "Untitled" when it is blank', () => {
			expect(resolveDuplicateName('  Handbook  ', [])).toEqual({ name: 'Handbook', suffixed: false });
			expect(resolveDuplicateName('   ', [])).toEqual({ name: 'Untitled', suffixed: false });
		});

		it('fills a gap left in the sequence instead of always appending', () => {
			expect(resolveDuplicateName('Handbook', ['Handbook', 'Handbook (3)'])).toEqual({
				name: 'Handbook (2)',
				suffixed: true
			});
		});
	});

	describe('inferMimeTypeFromKey (09 §6.2 — no byte read)', () => {
		it('infers common document and image types from the extension', () => {
			expect(inferMimeTypeFromKey('org/docs/policy.pdf')).toBe('application/pdf');
			expect(inferMimeTypeFromKey('avatar.PNG')).toBe('image/png');
			expect(inferMimeTypeFromKey('sheet.xlsx')).toBe(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			);
		});

		it('ignores query strings and fragments on legacy URLs', () => {
			expect(inferMimeTypeFromKey('https://cdn.example.com/a/policy.pdf?token=abc#page=2')).toBe(
				'application/pdf'
			);
		});

		it('returns null for unknown or missing extensions', () => {
			expect(inferMimeTypeFromKey('no-extension')).toBeNull();
			expect(inferMimeTypeFromKey('archive.weirdext')).toBeNull();
			expect(inferMimeTypeFromKey(null)).toBeNull();
			expect(inferMimeTypeFromKey('')).toBeNull();
		});
	});

	describe('sanitizeLegacyHtml', () => {
		it('drops script/style/iframe blocks and inline handlers', () => {
			const sanitized = sanitizeLegacyHtml(
				'<p onclick="steal()">Hi</p><script>alert(1)</script><iframe src="x"></iframe>'
			);
			expect(sanitized).not.toContain('<script');
			expect(sanitized).not.toContain('<iframe');
			expect(sanitized).not.toContain('onclick');
			expect(sanitized).toContain('Hi');
		});

		it('neutralizes javascript: URLs', () => {
			expect(sanitizeLegacyHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
		});

		it('still neutralizes javascript: URLs written with odd spacing and quoting', () => {
			// The whitespace/quote handling was restructured to kill quadratic backtracking, so
			// pin the variants that restructuring could plausibly have broken.
			expect(sanitizeLegacyHtml('<a href = "javascript:alert(1)">x</a>')).not.toContain('javascript:');
			expect(sanitizeLegacyHtml("<a href='javascript:alert(1)'>x</a>")).not.toContain('javascript:');
			expect(sanitizeLegacyHtml('<a href=javascript:alert(1)>x</a>')).not.toContain('javascript:');
			expect(sanitizeLegacyHtml('<img SRC="  javascript:alert(1)">')).not.toContain('javascript:');
		});
	});

	/**
	 * Bypasses of the regex denylist this function used to be (CodeQL
	 * `js/incomplete-multi-character-sanitization` ×3).
	 *
	 * Every case below produced live markup out of the old chain of `.replace()` calls. They are
	 * kept as regression tests now that the implementation is the shared parser-backed allowlist:
	 * a denylist of regexes cannot be made complete, because each pass edits the string the next
	 * pass reads — and a removal can splice a *new* construct together behind the cursor.
	 */
	describe('sanitizeLegacyHtml — bypasses of the old regex denylist', () => {
		it('does not let a removed tag splice a live <script> together', () => {
			// The old chain: pass 1 (`<tag>…</tag>` blocks) found no `</style>` so it did nothing;
			// pass 2 (`<tag …>`) then deleted `<style>` — which joined `<scr` to `ipt>` and handed
			// the output a complete, executable `<script>alert(1)</script>`.
			const sanitized = sanitizeLegacyHtml('<scr<style>ipt>alert(1)</script>');

			expect(sanitized.toLowerCase()).not.toContain('<script');
			// What is left is inert text, not markup: the parser escapes the stray `>`.
			expect(sanitized).not.toContain('>alert(1)');
			expect(sanitized).toContain('&gt;');
		});

		it('does not let a removed tag splice a live <iframe> together', () => {
			const sanitized = sanitizeLegacyHtml('<<style>iframe src="https://evil.example/x"></iframe>');

			expect(sanitized.toLowerCase()).not.toContain('<iframe');
		});

		it('strips an event handler introduced by a slash instead of whitespace', () => {
			// The handler pass required `\s` before `on…`. An HTML tokenizer also starts a new
			// attribute after `/`, so this fired on render while the regex saw nothing.
			// (Verified against a spec-compliant parser: `onerror` really is an attribute here.)
			const sanitized = sanitizeLegacyHtml('<img/onerror=alert(1) src=x>');

			expect(sanitized.toLowerCase()).not.toContain('onerror');
		});

		it('strips an event handler butted straight against a quoted attribute value', () => {
			// `"` is not `\s` either, and every browser recovers from the missing separator by
			// starting a new attribute — so `onerror` was live here too.
			const sanitized = sanitizeLegacyHtml('<img src="x"onerror=alert(1)>');

			expect(sanitized.toLowerCase()).not.toContain('onerror');
		});

		it('neutralizes an entity-encoded javascript: URL', () => {
			// The browser decodes `&#106;` before resolving the URL; the regex compared bytes.
			const sanitized = sanitizeLegacyHtml('<a href="&#106;avascript:alert(1)">x</a>');

			expect(sanitized.toLowerCase()).not.toContain('javascript:');
			expect(sanitized).not.toContain('&#106;avascript');
		});

		it('neutralizes a javascript: URL split by an embedded tab', () => {
			const sanitized = sanitizeLegacyHtml('<a href="jav\tascript:alert(1)">x</a>');

			expect(sanitized.replace(/\s/g, '').toLowerCase()).not.toContain('javascript:');
		});

		it('drops data: and vbscript: URLs, which the denylist never looked for', () => {
			expect(sanitizeLegacyHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>')).not.toContain('data:');
			expect(sanitizeLegacyHtml('<a href="vbscript:msgbox(1)">x</a>')).not.toContain('vbscript:');
			expect(sanitizeLegacyHtml('<img src="data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E">')).not.toContain(
				'data:'
			);
		});

		it('drops svg/math payloads and form widgets the denylist did not enumerate', () => {
			const sanitized = sanitizeLegacyHtml(
				'<svg><animate onbegin="alert(1)"/></svg><form><input name="x"></form>'
			);

			expect(sanitized.toLowerCase()).not.toContain('<svg');
			expect(sanitized.toLowerCase()).not.toContain('onbegin');
			expect(sanitized.toLowerCase()).not.toContain('<form');
			expect(sanitized.toLowerCase()).not.toContain('<input');
		});

		it('keeps the legitimate legacy article markup it is there to preserve', () => {
			const sanitized = sanitizeLegacyHtml(
				'<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p>' +
					'<ul><li>one</li></ul><a href="https://ever.co">link</a>' +
					'<img src="https://cdn.ever.co/a.png" alt="a">' +
					'<table><tr><td>cell</td></tr></table>'
			);

			expect(sanitized).toContain('<h2>Title</h2>');
			expect(sanitized).toContain('<strong>Bold</strong>');
			expect(sanitized).toContain('<em>italic</em>');
			expect(sanitized).toContain('<li>one</li>');
			expect(sanitized).toContain('https://ever.co');
			expect(sanitized).toContain('https://cdn.ever.co/a.png');
			expect(sanitized).toContain('cell');
		});

		it('is idempotent, so re-importing an already-migrated article is a no-op', () => {
			const once = sanitizeLegacyHtml('<p onclick="x()">Hi <a href="https://ever.co">link</a></p>');

			expect(sanitizeLegacyHtml(once)).toBe(once);
		});
	});

	describe('legacy HTML sanitization cost (ReDoS regression)', () => {
		/**
		 * Legacy HTML arrives from an untrusted export and is sanitized on the request thread.
		 * `\s*(["']?)\s*javascript:` and `<[^>]*>` were both quadratic — 80 KB of the right
		 * padding cost seconds — so these inputs pin the linear behaviour. The budget is
		 * generous; a linear pass does them in single-digit milliseconds.
		 */
		const BUDGET_MS = 100;

		const elapsed = (fn: () => void): number => {
			const started = Date.now();
			fn();
			return Date.now() - started;
		};

		it('sanitizes an attribute padded with a huge whitespace run in linear time', () => {
			const hostile = `<a href=${' '.repeat(200_000)}x>y</a>`;

			expect(elapsed(() => sanitizeLegacyHtml(hostile))).toBeLessThan(BUDGET_MS);
		});

		it('detects emptiness on a run of unterminated tags in linear time', () => {
			const hostile = '<'.repeat(200_000);
			let empty: boolean | undefined;

			const took = elapsed(() => {
				empty = isEmptyHtml(hostile);
			});

			expect(took).toBeLessThan(BUDGET_MS);
			// Unterminated `<` is not a tag, so it survives as visible text — unchanged behaviour.
			expect(empty).toBe(false);
		});
	});

	describe('isEmptyHtml (09 §7 case 4)', () => {
		it('treats markup-only and entity-only content as empty', () => {
			expect(isEmptyHtml(null)).toBe(true);
			expect(isEmptyHtml('')).toBe(true);
			expect(isEmptyHtml('<p></p>')).toBe(true);
			expect(isEmptyHtml('<p>&nbsp;</p>')).toBe(true);
		});

		it('detects real text', () => {
			expect(isEmptyHtml('<p>Getting started</p>')).toBe(false);
		});
	});

	describe('parseJsonColumn', () => {
		it('passes objects through and parses serialized SQLite text', () => {
			const object = { type: 'doc' };
			expect(parseJsonColumn(object)).toBe(object);
			expect(parseJsonColumn('{"type":"doc"}')).toEqual({ type: 'doc' });
		});

		it('returns null for empty, scalar, or malformed values', () => {
			expect(parseJsonColumn(null)).toBeNull();
			expect(parseJsonColumn('   ')).toBeNull();
			expect(parseJsonColumn('not json')).toBeNull();
			expect(parseJsonColumn('42')).toBeNull();
		});
	});
});
