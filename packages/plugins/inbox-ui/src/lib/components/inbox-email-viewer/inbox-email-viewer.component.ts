// cspell:ignore referrerpolicy srcdoc
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, viewChild } from '@angular/core';
import { emailBlocksOf } from '../../inbox-ui.helpers';

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
		'<style>body{margin:0;padding:16px 20px;font:13px/1.6 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#222b45;overflow-wrap:anywhere}pre{white-space:pre-wrap;font:inherit;margin:0}img{max-width:100%;height:auto}a{color:#3366ff}</style>';
	const body = html && html.trim() ? html : `<pre>${escapeHtml(text ?? '')}</pre>`;
	return `<!doctype html><html><head>${head}${style}</head><body>${body}</body></html>`;
}

/**
 * Shows an email (plan 04 §1, the "Email" detail pane).
 *
 * A **plain-text** message is shown as text in the pane, in the app's own type and colours (dark theme included),
 * with quoted lines and the signature set apart: Angular interpolates it as text, so nothing in it is ever read as
 * markup.
 *
 * An **HTML** message is shown inside a **sandboxed `<iframe srcdoc>`** only:
 * - `sandbox=""` grants nothing: no scripts, no same-origin access to the app (the frame has an opaque
 *   origin), no forms, no popups, no top navigation.
 * - The document's own CSP (`EMAIL_DOCUMENT_CSP`) blocks every fetch, so remote images (tracking pixels) do
 *   not load either.
 * - The HTML is never put into the app's DOM, and `bypassSecurityTrustHtml` is not used. `srcdoc` is set
 *   on the element rather than bound: Angular's HTML sanitizer would strip the CSP `<meta>` and `<style>`
 *   from a bound value, which would let remote images load. The sandbox and the CSP are the boundary.
 */
@Component({
	selector: 'ngx-inbox-email-viewer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (hasHtml()) {
			<!-- An HTML email keeps its own design: shown on white paper, as mail apps show it. -->
			<iframe
				#frame
				class="email-frame"
				data-test="email-frame"
				sandbox=""
				referrerpolicy="no-referrer"
				[attr.title]="title()"
			></iframe>
		} @else {
			<div class="email-text" data-test="email-text">
				@for (block of blocks(); track $index) {
					<div class="block" [attr.data-kind]="block.kind">{{ block.text }}</div>
				}
			</div>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.email-text {
				max-width: 72ch;
				font-size: 0.75rem;
				line-height: 1.25rem;
				color: var(--gauzy-text-color-1, #222b45);
			}
			.block {
				white-space: pre-wrap;
				overflow-wrap: anywhere;
			}
			.block + .block {
				margin-top: 0.875rem;
			}
			/* A quoted earlier message: muted, behind a thin rule. */
			.block[data-kind='quote'] {
				padding-left: 0.75rem;
				border-left: 2px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			/* The signature: smaller and muted, under a short rule. */
			.block[data-kind='signature'] {
				padding-top: 0.625rem;
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
				font-size: 0.6875rem;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.email-frame {
				display: block;
				width: 100%;
				min-height: 320px;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.24));
				border-radius: 0.5rem;
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

	readonly hasHtml = computed(() => !!this.html()?.trim());
	readonly document = computed(() => emailDocument(this.html(), this.text()));
	/** A plain-text message in blocks: what was written, quotes, the signature. */
	readonly blocks = computed(() => emailBlocksOf(this.text()));

	private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

	constructor() {
		effect(() => {
			const frame = this.frame()?.nativeElement;
			if (!frame) return;
			// Re-assert the empty sandbox before every load (it must be in place before srcdoc is set).
			frame.setAttribute('sandbox', '');
			frame.srcdoc = this.document();
		});
	}
}
