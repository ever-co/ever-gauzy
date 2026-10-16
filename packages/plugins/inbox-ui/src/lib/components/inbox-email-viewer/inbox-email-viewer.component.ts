import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, viewChild } from '@angular/core';

/** Escapes text for the viewer's document (a plain-text message is shown as text, never as markup). */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** The policy of the viewer's document: no script, no fetch, no remote image (no tracking pixel), no form. */
export const EMAIL_DOCUMENT_CSP =
	"default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";

/**
 * The document the viewer frame shows: the message's HTML (sanitized by the API, plan 04 §5.3), or its text
 * escaped into a `<pre>`. Its own Content-Security-Policy blocks scripts, remote images and every other fetch,
 * on top of the frame's sandbox.
 */
export function emailDocument(html: string | null | undefined, text: string | null | undefined): string {
	const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${EMAIL_DOCUMENT_CSP}"><base target="_blank">`;
	const style =
		'<style>body{margin:0;padding:12px;font:14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}pre{white-space:pre-wrap;font:inherit;margin:0}img{max-width:100%}</style>';
	const body = html && html.trim() ? html : `<pre>${escapeHtml(text ?? '')}</pre>`;
	return `<!doctype html><html><head>${head}${style}</head><body>${body}</body></html>`;
}

/**
 * Shows an email (plan 04 §1, the "Email" detail pane) inside a **sandboxed `<iframe srcdoc>`**.
 *
 * - `sandbox=""` grants nothing: no scripts, no same-origin access to the app (the frame has an opaque
 *   origin), no forms, no popups, no top navigation.
 * - The document's own CSP (`EMAIL_DOCUMENT_CSP`) blocks every fetch, so remote images (tracking pixels) do
 *   not load either.
 * - The message is never put into the app's DOM, and `bypassSecurityTrustHtml` is not used. `srcdoc` is set
 *   on the element rather than bound: Angular's HTML sanitizer would strip the CSP `<meta>` and `<style>`
 *   from a bound value, which would let remote images load. The sandbox and the CSP are the boundary.
 */
@Component({
	selector: 'ngx-inbox-email-viewer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<iframe
			#frame
			class="email-frame"
			data-test="email-frame"
			sandbox=""
			referrerpolicy="no-referrer"
			[attr.title]="title()"
		></iframe>
	`,
	styles: [
		`
			.email-frame {
				width: 100%;
				min-height: 320px;
				border: 1px solid var(--border-basic-color-3, #e4e9f2);
				border-radius: 4px;
				background: #fff;
			}
		`
	]
})
export class InboxEmailViewerComponent {
	/** The sanitized HTML of the message, when it has one (P4: the stored email). */
	readonly html = input<string | null | undefined>(null);
	/** The text of the message (shown when there is no HTML). */
	readonly text = input<string | null | undefined>(null);
	readonly title = input<string>('Email');

	readonly document = computed(() => emailDocument(this.html(), this.text()));

	private readonly frame = viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

	constructor() {
		effect(() => {
			const frame = this.frame().nativeElement;
			// Re-assert the empty sandbox before every load (it must be in place before srcdoc is set).
			frame.setAttribute('sandbox', '');
			frame.srcdoc = this.document();
		});
	}
}
