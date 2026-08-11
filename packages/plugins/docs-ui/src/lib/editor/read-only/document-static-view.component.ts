import { isPlatformBrowser } from '@angular/common';
import {
	AfterViewChecked,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	Input,
	OnChanges,
	OnDestroy,
	PLATFORM_ID,
	ViewChild,
	inject
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { renderToHTMLString } from '@tiptap/static-renderer';
import { firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { DocumentsService } from '../../services/documents.service';
import { createStaticExtensions } from '../extensions/document-extensions';
import { renderMarkdownToSanitizedHtml, sanitizeHtml } from './markdown-render.util';
import { parseRawDocumentId } from './raw-image.util';

/**
 * Static read-only render (spec 05 §9.1): TipTap JSON → HTML via
 * `@tiptap/static-renderer` (no editor, no ProseMirror view), used by the page
 * read view, version previews and print. Also renders FILE `extractedText`
 * markdown previews (via `marked`, the engine `@tiptap/markdown` builds on).
 * Everything passes through Angular's HTML sanitizer before binding.
 *
 * 🛑 Embedded images persist `/api/plugins/docs/documents/{id}/raw` as their `src`
 * — an authenticated, `DOCS_READ`-guarded stream whose JWT strategy reads the
 * Authorization header only. The browser sends no header for an `<img>`, so every
 * such image 401s. After each render the view re-points those images at object
 * URLs fetched through the authenticated `HttpClient`, exactly as the live
 * editor's `image` node view does; the bound HTML keeps the `/raw` reference.
 */
@Component({
	selector: 'gz-document-static-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<div #host class="gz-static-view ProseMirror" [innerHTML]="safeHtml"></div>`,
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
export class DocumentStaticViewComponent implements OnChanges, AfterViewChecked, OnDestroy {
	/** Canonical TipTap JSON (preferred input). */
	@Input() contentJson: unknown | null = null;
	/** Server-sanitized render cache fallback. */
	@Input() contentHtml: string | null = null;
	/** FILE extracted-text markdown preview. */
	@Input() markdown: string | null = null;

	@ViewChild('host') private hostRef?: ElementRef<HTMLElement>;

	private readonly sanitizer = inject(DomSanitizer);
	private readonly documentsService = inject(DocumentsService);
	private readonly platformId = inject(PLATFORM_ID);

	/** Sanitized HTML, bound with `[innerHTML]` so Angular sanitizes it again on binding. */
	public safeHtml: string | null = null;

	/** Object URLs minted for this render — revoked whenever the content changes. */
	private objectUrls: string[] = [];
	/** Set by `ngOnChanges`, consumed once by the next `ngAfterViewChecked`. */
	private pendingImageSwap = false;
	/**
	 * Bumped by every render. A blob that arrives after the inputs changed belongs to
	 * content that is no longer on screen and must not be written into the new DOM.
	 */
	private renderSession = 0;

	ngOnChanges(): void {
		this.releaseObjectUrls();
		this.renderSession += 1;
		this.safeHtml = this.render();
		this.pendingImageSwap = !!this.safeHtml && isPlatformBrowser(this.platformId);
	}

	ngAfterViewChecked(): void {
		if (!this.pendingImageSwap) return;
		this.pendingImageSwap = false;
		void this.resolveEmbeddedImages(this.renderSession);
	}

	ngOnDestroy(): void {
		this.releaseObjectUrls();
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

	/**
	 * Swaps every `/raw` image in the rendered DOM for an authenticated object URL.
	 *
	 * Read with `getAttribute('src')` rather than `img.src`: the property resolves to an
	 * absolute URL, and the authored value is what carries the plugin path. Each id is
	 * fetched once even when the same image appears several times. Failures are left alone
	 * — the browser's own broken-image state is the honest outcome for a deleted document.
	 */
	private async resolveEmbeddedImages(session: number): Promise<void> {
		const host = this.hostRef?.nativeElement;
		if (!host) return;
		const images = Array.from(host.querySelectorAll('img'));
		const byDocumentId = new Map<string, HTMLImageElement[]>();
		for (const image of images) {
			const documentId = parseRawDocumentId(image.getAttribute('src'));
			if (!documentId) continue;
			const group = byDocumentId.get(documentId) ?? [];
			group.push(image);
			byDocumentId.set(documentId, group);
		}

		await Promise.all(
			[...byDocumentId].map(async ([documentId, targets]) => {
				try {
					const blob = await firstValueFrom(this.documentsService.getRawBlob(documentId as ID));
					if (session !== this.renderSession) return;
					const objectUrl = URL.createObjectURL(blob);
					this.objectUrls.push(objectUrl);
					targets.forEach((image) => image.setAttribute('src', objectUrl));
				} catch {
					// Deleted document / revoked access — nothing to bind.
				}
			})
		);
	}

	private releaseObjectUrls(): void {
		this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
		this.objectUrls = [];
	}
}
