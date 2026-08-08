import { ChangeDetectionStrategy, Component, Input, OnChanges, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { renderToHTMLString } from '@tiptap/static-renderer';
import { createStaticExtensions } from '../extensions/document-extensions';
import { renderMarkdownToSanitizedHtml, sanitizeHtml } from './markdown-render.util';

/**
 * Static read-only render (spec 05 §9.1): TipTap JSON → HTML via
 * `@tiptap/static-renderer` (no editor, no ProseMirror view), used by the page
 * read view, version previews and print. Also renders FILE `extractedText`
 * markdown previews (via `marked`, the engine `@tiptap/markdown` builds on).
 * Everything passes through Angular's HTML sanitizer before binding.
 */
@Component({
	selector: 'gz-document-static-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<div class="gz-static-view ProseMirror" [innerHTML]="safeHtml"></div>`,
	styles: [
		`
			:host {
				display: block;
			}
			.gz-static-view {
				line-height: 1.6;
			}
		`
	]
})
export class DocumentStaticViewComponent implements OnChanges {
	/** Canonical TipTap JSON (preferred input). */
	@Input() contentJson: unknown | null = null;
	/** Server-sanitized render cache fallback. */
	@Input() contentHtml: string | null = null;
	/** FILE extracted-text markdown preview. */
	@Input() markdown: string | null = null;

	private readonly sanitizer = inject(DomSanitizer);

	/** Sanitized HTML, bound with `[innerHTML]` so Angular sanitizes it again on binding. */
	public safeHtml: string | null = null;

	ngOnChanges(): void {
		this.safeHtml = this.render();
	}

	private render(): string | null {
		if (this.contentJson) {
			try {
				return sanitizeHtml(
					renderToHTMLString({
						extensions: createStaticExtensions(),
						content: this.contentJson as never
					}),
					this.sanitizer
				);
			} catch {
				return sanitizeHtml(this.contentHtml, this.sanitizer);
			}
		}
		if (this.markdown) {
			// Same renderer the file preview modal uses (`markdown-render.util.ts`).
			return renderMarkdownToSanitizedHtml(this.markdown, this.sanitizer);
		}
		return sanitizeHtml(this.contentHtml, this.sanitizer);
	}
}
