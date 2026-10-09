import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DoCheck, OnDestroy, inject } from '@angular/core';
import { NbButtonModule, NbIconModule, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { DocumentsService } from '../../services/documents.service';
import { AngularNodeViewComponent } from '../node-view/angular-node-view-renderer';
import { IImageSource, resolveImageSource } from '../read-only/raw-image.util';
import { sanitizeMediaUrl } from '../read-only/safe-url.util';
import { EditorUploadService, IEditorUpload } from '../services/editor-upload.service';

/**
 * Node view for `image` (spec 05 §6.6 step 5).
 *
 * 🛑 The persisted `src` is the authenticated stream `/api/plugins/docs/documents/{id}/raw`,
 * which is guarded by `@Permissions(DOCS_READ)` and a header-only JWT strategy. A bare
 * `<img src>` carries no `Authorization` header, so every embedded image rendered straight
 * from the attribute came back 401 and displayed broken. This view keeps `/raw` in the
 * document (it is the stable, shareable reference) and renders bytes fetched through the
 * authenticated `HttpClient` as an object URL — the same trick
 * `file-attachment-node-view.component.ts` uses for downloads.
 *
 * The uploading placeholder is unchanged: it has no `documentId` yet and its `src` is the
 * local blob preview, which is bound as-is behind the shared media-URL scheme allowlist.
 */
@Component({
	selector: 'gz-image-node-view',
	standalone: true,
	imports: [CommonModule, TranslateModule, NbButtonModule, NbIconModule, NbProgressBarModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<figure class="gz-image-node" [class.selected]="selected()" [attr.data-align]="align">
			<img
				*ngIf="displaySrc; else placeholder"
				class="gz-image"
				[src]="displaySrc"
				[alt]="alt"
				[style.width]="width"
				draggable="false"
			/>
			<ng-template #placeholder>
				<div class="gz-image-fallback" role="img" [attr.aria-label]="alt">
					<nb-icon [icon]="failed ? 'alert-circle-outline' : 'image-outline'"></nb-icon>
					<span *ngIf="failed">{{ 'DOCS.EDITOR.IMAGE.UNAVAILABLE' | translate }}</span>
					<span *ngIf="!failed">{{ 'DOCS.EDITOR.IMAGE.LOADING' | translate }}</span>
				</div>
			</ng-template>

			<nb-progress-bar
				*ngIf="upload?.status === 'uploading'"
				[value]="upload?.progress ?? 0"
				size="tiny"
				status="primary"
			></nb-progress-bar>

			<div class="gz-image-actions" *ngIf="upload?.status === 'error'">
				<span class="gz-image-error">{{ 'DOCS.EDITOR.ATTACHMENT.FAILED' | translate }}</span>
				<button nbButton ghost size="tiny" status="primary" type="button" (click)="retry()">
					{{ 'DOCS.EDITOR.ATTACHMENT.RETRY' | translate }}
				</button>
				<button nbButton ghost size="tiny" status="danger" type="button" (click)="remove()">
					{{ 'DOCS.EDITOR.ATTACHMENT.REMOVE' | translate }}
				</button>
			</div>
		</figure>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.gz-image-node {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				margin: 0.5rem 0;
			}
			.gz-image-node[data-align='center'] {
				align-items: center;
			}
			.gz-image-node[data-align='right'] {
				align-items: flex-end;
			}
			.gz-image-node.selected .gz-image,
			.gz-image-node.selected .gz-image-fallback {
				outline: 2px solid var(--color-primary-transparent-300);
			}
			.gz-image {
				max-width: 100%;
				height: auto;
				border-radius: var(--border-radius);
			}
			.gz-image-fallback {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
				min-height: 6rem;
				padding: 1rem;
				border: 1px dashed var(--border-basic-color-3);
				border-radius: var(--border-radius);
				color: var(--text-hint-color);
				font-size: 0.75rem;
			}
			.gz-image-actions {
				display: flex;
				align-items: center;
				gap: 0.375rem;
			}
			.gz-image-error {
				font-size: 0.75rem;
				color: var(--color-danger-default);
			}
		`
	]
})
export class ImageNodeViewComponent extends AngularNodeViewComponent implements DoCheck, OnDestroy {
	private readonly documentsService = inject(DocumentsService);
	private readonly uploadService = inject(EditorUploadService, { optional: true });
	private readonly changeDetectorRef = inject(ChangeDetectorRef);

	/** What the `<img>` actually binds — an object URL, a blob preview, or `null` while resolving. */
	public displaySrc: string | null = null;
	/** True once the bytes could not be fetched (deleted document, revoked access, network). */
	public failed = false;

	private objectUrl: string | null = null;
	/** `IImageSource.key` of the attributes currently resolved — re-resolving is skipped while equal. */
	private resolvedKey: string | null = null;
	/**
	 * Bumped by every resolve. `update()` patches the `node` input in place, so a slow
	 * response for the previous document id must never overwrite a newer one's URL.
	 */
	private resolveSession = 0;

	/**
	 * The renderer patches the `node` input and calls `detectChanges()` on every same-type
	 * update (the placeholder→final upload swap being the one that matters), so the source
	 * is re-derived here rather than in `ngOnChanges` — signal inputs set through
	 * `ComponentRef.setInput` do not produce `SimpleChanges` on this component.
	 */
	ngDoCheck(): void {
		void this.syncSource(resolveImageSource(this.node().attrs));
	}

	ngOnDestroy(): void {
		this.releaseObjectUrl();
	}

	get alt(): string {
		return (this.node().attrs['alt'] as string) || '';
	}

	get width(): string | null {
		const width = this.node().attrs['width'];
		if (!width) return null;
		return typeof width === 'number' ? `${width}px` : String(width);
	}

	get align(): string | null {
		return (this.node().attrs['align'] as string | null) ?? null;
	}

	get upload(): IEditorUpload | undefined {
		return this.uploadService?.getUpload(this.node().attrs['uploadId'] as string | null);
	}

	retry(): void {
		const uploadId = this.node().attrs['uploadId'] as string | null;
		if (uploadId) this.uploadService?.retry(this.editor(), uploadId);
	}

	remove(): void {
		const uploadId = this.node().attrs['uploadId'] as string | null;
		if (uploadId) this.uploadService?.remove(this.editor(), uploadId);
		else this.deleteNode()();
	}

	// ─── Internals ───────────────────────────────────────────────

	/**
	 * Points the `<img>` at something the browser can actually load.
	 *
	 * A `documentId` (or a `/raw` src it can be read out of) means the bytes live behind the
	 * authenticated route — fetch them once and bind the object URL. Anything else (the blob
	 * preview of an in-flight upload, an external https image) is bound directly, behind the
	 * shared scheme allowlist.
	 */
	private async syncSource(source: IImageSource): Promise<void> {
		// `ngDoCheck` runs on every change-detection pass; the key makes the work idempotent.
		if (source.key === this.resolvedKey) return;
		this.resolvedKey = source.key;

		if (!source.documentId) {
			this.releaseObjectUrl();
			this.failed = false;
			this.displaySrc = sanitizeMediaUrl(source.previewSrc);
			this.changeDetectorRef.markForCheck();
			return;
		}

		const session = ++this.resolveSession;
		this.releaseObjectUrl();
		this.failed = false;
		// Keep the blob preview on screen while the authenticated fetch runs, so the
		// placeholder→final swap does not flash an empty box.
		this.displaySrc = source.previewSrc?.startsWith('blob:') ? source.previewSrc : null;
		this.changeDetectorRef.markForCheck();

		try {
			const blob = await firstValueFrom(this.documentsService.getRawBlob(source.documentId as ID));
			if (session !== this.resolveSession) return;
			this.objectUrl = URL.createObjectURL(blob);
			this.displaySrc = this.objectUrl;
		} catch {
			if (session !== this.resolveSession) return;
			// A deleted document or a revoked permission is a normal outcome here — the
			// fallback tile says so rather than leaving a broken-image glyph.
			this.failed = true;
			this.displaySrc = null;
		} finally {
			if (session === this.resolveSession) this.changeDetectorRef.markForCheck();
		}
	}

	private releaseObjectUrl(): void {
		if (!this.objectUrl) return;
		URL.revokeObjectURL(this.objectUrl);
		this.objectUrl = null;
	}
}
