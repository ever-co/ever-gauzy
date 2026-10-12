import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { stripUnsafeUrls } from './safe-url.util';

/**
 * Shared read-only markdown render path (`01-ux-spec.md` §9, `05-editor-spec.md`
 * §9.1): markdown → HTML through `marked` (the engine `@tiptap/markdown` builds
 * on), then through Angular's HTML sanitizer — never raw HTML injection.
 *
 * Deliberately free of any `@tiptap/*` import so the file preview modal, which
 * ships in the browse chunk, can reuse the exact renderer the editor's static
 * view uses for `extractedText` without dragging the editor stack along
 * (`05-editor-spec.md` §12 keeps TipTap behind the `page/:id` route).
 *
 * @param markdown Raw markdown (extracted text, or a page exported to markdown).
 * @param sanitizer Angular's `DomSanitizer`.
 * @returns Sanitized HTML — or `null` when there is nothing to render.
 */
export function renderMarkdownToSanitizedHtml(
	markdown: string | null | undefined,
	sanitizer: DomSanitizer
): string | null {
	if (!markdown) return null;
	const html = marked.parse(markdown, { async: false }) as string;
	return sanitizeHtml(html, sanitizer);
}

/**
 * Sanitizes an already-rendered HTML string. Shared by the markdown path above and the
 * TipTap static render.
 *
 * 🛑 Returns a PLAIN STRING, not a `SafeHtml`, and that is deliberate. Everything reaching
 * this function is attacker-controlled — an uploaded HTML/markdown file, or a page authored
 * by another tenant user — so it must never be marked as trusted. This used to end with
 * `bypassSecurityTrustHtml(sanitized)`, which bought nothing: the value is bound with
 * `[innerHTML]`, so Angular sanitizes it on binding anyway. The bypass only removed the
 * second, authoritative check while leaving the result indistinguishable from genuinely
 * trusted markup to anyone reading the call site.
 *
 * Binding a plain string keeps BOTH passes: the explicit one here (so callers can test the
 * neutralized output and so an empty result collapses to `null`) and Angular's own on
 * binding. Allowlist sanitization is idempotent, so the rendered output is unchanged.
 *
 * 🛑 Angular's pass is NOT sufficient on its own for URLs. Its URL check is a denylist of a
 * single scheme (`javascript:`), so `data:text/html;base64,…`, `data:image/svg+xml,…` and
 * `vbscript:…` all come back untouched — see `safe-url.util.ts`, which holds the app's
 * scheme ALLOWLIST and is applied here to every `href`/`src` Angular let through. Running it
 * after Angular means it works on parsed, already-structurally-safe markup.
 *
 * @param html Untrusted HTML.
 * @param sanitizer Angular's `DomSanitizer`.
 * @returns Sanitized HTML — or `null` when nothing survives sanitization.
 */
export function sanitizeHtml(html: string | null | undefined, sanitizer: DomSanitizer): string | null {
	if (!html) return null;
	const sanitized = sanitizer.sanitize(SecurityContext.HTML, html);
	if (!sanitized) return null;
	return stripUnsafeUrls(sanitized) || null;
}
