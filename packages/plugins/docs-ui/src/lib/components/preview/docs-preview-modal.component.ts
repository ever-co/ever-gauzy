import { Component, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsActions } from '../../+state/documents.actions';
import { renderMarkdownToSanitizedHtml } from '../../editor/read-only/markdown-render.util';
import { sanitizeMediaUrl } from '../../editor/read-only/safe-url.util';
import { DocumentsService } from '../../services/documents.service';
import { PdfViewerComponent } from './pdf-viewer.component';

/** Citation locator passed when the preview opens from an AI answer (spec 07). */
export interface IDocsPreviewLocator {
	page?: number;
	headingPath?: string[];
	snippet?: string;
}

export type DocsPreviewViewer = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'extracted' | 'fallback';

/**
 * Full-screen per-mime preview (`01-ux-spec.md` §9): pdf (pdfjs wrapper),
 * images, video/audio (native tags), markdown/extracted-text (sanitized
 * `marked` render — same pipeline as the editor's static markdown path, kept
 * local so `@tiptap/*` stays out of the browse chunk), and a graceful download
 * fallback card. Binary content is fetched through the authenticated HTTP
 * client and served from object URLs. `Esc` closes (Nebular), `←`/`→` page
 * through a pdf.
 */
@Component({
	selector: 'gz-docs-preview-modal',
	templateUrl: './docs-preview-modal.component.html',
	styleUrls: ['./docs-preview-modal.component.scss'],
	standalone: false
})
export class DocsPreviewModalComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() document: IDocument;
	@Input() locator: IDocsPreviewLocator | null = null;

	@ViewChild(PdfViewerComponent) pdfViewer: PdfViewerComponent | undefined;

	public viewer: DocsPreviewViewer = 'fallback';
	public loading = false;
	public blob: Blob | null = null;
	/**
	 * The `blob:` object URL for the img/video/audio viewers, bound as a plain string.
	 *
	 * Not wrapped in `bypassSecurityTrustUrl`: `URL.createObjectURL` always returns
	 * `blob:<origin>/<uuid>`, which Angular's URL sanitizer passes through untouched. The
	 * bypass was therefore doing nothing except disabling the check that would catch this
	 * binding if the source of the URL ever changed to something attacker-influenced.
	 *
	 * 🛑 And Angular's check alone would not be enough if it did: it rejects `javascript:` and
	 * nothing else, so `data:text/html`/`vbscript:` would sail into `<img|video|audio [src]>`.
	 * The value is therefore assigned through `sanitizeMediaUrl`, the app's scheme allowlist.
	 */
	public mediaUrl: string | null = null;
	/** Sanitized HTML, bound with `[innerHTML]` so Angular sanitizes it again on binding. */
	public textHtml: string | null = null;
	public plainText: string | null = null;
	public pdfPage = 0;
	public pdfTotal = 0;

	private objectUrl: string | null = null;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<DocsPreviewModalComponent>,
		private readonly documentsService: DocumentsService,
		private readonly sanitizer: DomSanitizer,
		private readonly actions: Actions
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.viewer = this.resolveViewer();
		void this.loadContent();
	}

	ngOnDestroy(): void {
		if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
	}

	// ─── Chrome actions ──────────────────────────────────────────

	close(): void {
		this.dialogRef.close();
	}

	download(): void {
		if (this.document) {
			window.open(this.documentsService.downloadUrl(this.document.id as ID), '_blank');
		}
	}

	openDetails(): void {
		this.actions.dispatch(DocumentsActions.detailOpened(this.document.id as ID));
		this.dialogRef.close();
	}

	@HostListener('document:keydown.arrowRight')
	onArrowRight(): void {
		void this.pdfViewer?.next();
	}

	@HostListener('document:keydown.arrowLeft')
	onArrowLeft(): void {
		void this.pdfViewer?.prev();
	}

	onPdfPage(event: { page: number; totalPages: number }): void {
		this.pdfPage = event.page;
		this.pdfTotal = event.totalPages;
	}

	/** Any render failure degrades to the download card. */
	onRenderFailed(): void {
		this.viewer = 'fallback';
	}

	humanizeSize(bytes?: number): string {
		if (!bytes || bytes <= 0) return '';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	// ─── Viewer resolution / loading ─────────────────────────────

	/** MIME family → renderer, falling back to the `originalFilename` extension. */
	private resolveViewer(): DocsPreviewViewer {
		const doc = this.document;
		if (!doc || doc.kind !== DocumentKindEnum.FILE) return 'fallback';
		const mime = (doc.mimeType ?? '').toLowerCase();
		const ext = (doc.originalFilename ?? doc.name ?? '').split('.').pop()?.toLowerCase() ?? '';

		if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
		if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
		if (mime.startsWith('video/')) return 'video';
		if (mime.startsWith('audio/')) return 'audio';
		if (
			['text/markdown', 'text/plain', 'text/csv', 'text/html'].includes(mime) ||
			['md', 'txt', 'csv', 'html'].includes(ext)
		) {
			return 'text';
		}
		// Office formats render from the extracted markdown with a notice.
		if (
			mime.includes('word') ||
			mime.includes('spreadsheet') ||
			mime.includes('presentation') ||
			mime.includes('opendocument') ||
			mime.includes('excel') ||
			['docx', 'xlsx', 'pptx', 'odt', 'ods'].includes(ext)
		) {
			return 'extracted';
		}
		return 'fallback';
	}

	private async loadContent(): Promise<void> {
		this.loading = true;
		try {
			switch (this.viewer) {
				case 'pdf':
				case 'image':
				case 'video':
				case 'audio': {
					this.blob = await firstValueFrom(this.documentsService.getRawBlob(this.document.id as ID));
					this.objectUrl = URL.createObjectURL(this.blob);
					this.mediaUrl = sanitizeMediaUrl(this.objectUrl);
					break;
				}
				case 'text':
				case 'extracted': {
					const result = await firstValueFrom(
						this.documentsService.getExtractedText(this.document.id as ID)
					);
					this.renderText(result?.extractedText ?? '');
					break;
				}
			}
		} catch {
			this.viewer = 'fallback';
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Markdown goes through the editor's shared read-only render util
	 * (`marked` → Angular's HTML sanitizer — never raw HTML injection), so the
	 * preview and the page read view render identical output. Plain text and CSV
	 * stay pre-formatted rather than being parsed as markdown.
	 */
	private renderText(text: string): void {
		const mime = (this.document.mimeType ?? '').toLowerCase();
		if (this.viewer === 'text' && (mime === 'text/plain' || mime === 'text/csv')) {
			this.plainText = text;
			return;
		}
		this.textHtml = renderMarkdownToSanitizedHtml(text, this.sanitizer);
	}
}
