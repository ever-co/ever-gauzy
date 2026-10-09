import { Pipe, PipeTransform, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Sanitizes an untrusted rich-text HTML string for `[innerHtml]` on the **public** pages.
 *
 * 🛑 This is the deliberate opposite of the shared `safeHtml` pipe, which calls
 * `bypassSecurityTrustHtml` and therefore switches Angular's sanitizer OFF. `Employee.description`
 * and `Organization.overview` are authored in the rich-text editor, stored as HTML and rendered on
 * `/public/:profile_link` — an UNAUTHENTICATED page — so a stored payload would have executed for
 * every anonymous visitor. Nothing on a public page is trusted markup; `safeHtml` must never appear
 * on one.
 *
 * 🛑 Returns a PLAIN STRING, not a `SafeHtml`, and that is deliberate — the same reasoning as
 * `renderMarkdownToSanitizedHtml` in `@gauzy/plugin-docs-ui`. Binding a plain string keeps BOTH
 * passes: the explicit one here (so the neutralized output is directly testable) and Angular's own
 * on binding. Sanitization is idempotent, so legitimate editor output renders unchanged.
 *
 * Depth in front of this pipe, not instead of it: the public API sanitizes `overview` /
 * `description` on the way out with the server-side **allowlist** sanitizer
 * (`@gauzy/core` `core/html-sanitizer`), whose `allowedSchemes` are `http`/`https`/`mailto`/`tel`
 * only. That covers the one gap Angular's own URL check leaves — it is a denylist of exactly one
 * scheme (`javascript:`), so `data:text/html;base64,…` and `vbscript:…` survive it.
 */
@Pipe({
	name: 'sanitizeHtml',
	standalone: true
})
export class SanitizeHtmlPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);

	/**
	 * Sanitizes untrusted HTML against Angular's HTML security context.
	 *
	 * `script`/`style` elements, event-handler attributes (`on*`), `iframe`/`object`/`embed` and
	 * `javascript:` URLs are all removed or neutralized; `null`/`undefined`/`''` pass through as
	 * an empty string so an absent field renders nothing.
	 *
	 * @param value The raw HTML string, as stored by the rich-text editor.
	 * @returns The sanitized HTML string.
	 */
	transform(value: string | null | undefined): string {
		if (!value) {
			return '';
		}
		return this.sanitizer.sanitize(SecurityContext.HTML, value) ?? '';
	}
}
