import { SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

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
 * @returns Sanitized, bindable HTML — or `null` when there is nothing to render.
 */
export function renderMarkdownToSafeHtml(
	markdown: string | null | undefined,
	sanitizer: DomSanitizer
): SafeHtml | null {
	if (!markdown) return null;
	const html = marked.parse(markdown, { async: false }) as string;
	return sanitizeToSafeHtml(html, sanitizer);
}

/**
 * Sanitizes an already-rendered HTML string and marks the result bindable.
 * Shared by the markdown path above and the TipTap static render.
 */
export function sanitizeToSafeHtml(html: string | null | undefined, sanitizer: DomSanitizer): SafeHtml | null {
	if (!html) return null;
	const sanitized = sanitizer.sanitize(SecurityContext.HTML, html);
	return sanitized ? sanitizer.bypassSecurityTrustHtml(sanitized) : null;
}
