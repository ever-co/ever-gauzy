import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NbButtonModule, NbIconModule, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DocumentsService } from '../../services/documents.service';
import { AngularNodeViewComponent } from '../node-view/angular-node-view-renderer';
import { EditorUploadService, IEditorUpload } from '../services/editor-upload.service';

/**
 * Node view for `fileAttachment` (spec 05 §6.2/§6.6): file-type icon, name,
 * humanized size, download + open-in-Documents actions; uploading placeholder
 * shows a progress bar, a failed upload flips to Retry / Remove; a card that
 * never resolved a `documentId` renders the "missing" state.
 */
@Component({
	selector: 'gz-file-attachment-node-view',
	standalone: true,
	imports: [CommonModule, TranslateModule, NbButtonModule, NbIconModule, NbProgressBarModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			class="gz-attachment-card"
			[class.selected]="selected()"
			[class.missing]="isMissing"
			tabindex="0"
			role="group"
		>
			<nb-icon class="gz-attachment-icon" [icon]="icon"></nb-icon>
			<div class="gz-attachment-meta">
				<span class="gz-attachment-name">{{ name }}</span>
				<span class="gz-attachment-size" *ngIf="!upload">{{ humanSize }}</span>
				<span class="gz-attachment-size" *ngIf="upload?.status === 'uploading'">
					{{ 'DOCS.EDITOR.ATTACHMENT.UPLOADING' | translate }}
				</span>
				<span class="gz-attachment-error" *ngIf="upload?.status === 'error'">
					{{ 'DOCS.EDITOR.ATTACHMENT.FAILED' | translate }}
				</span>
				<span class="gz-attachment-error" *ngIf="isMissing">
					{{ 'DOCS.EDITOR.ATTACHMENT.MISSING' | translate }}
				</span>
				<nb-progress-bar
					*ngIf="upload?.status === 'uploading'"
					[value]="upload?.progress ?? 0"
					size="tiny"
					status="primary"
				></nb-progress-bar>
			</div>
			<div class="gz-attachment-actions">
				<ng-container *ngIf="documentId">
					<a
						nbButton
						ghost
						size="tiny"
						[href]="downloadHref"
						target="_blank"
						rel="noopener noreferrer"
						[attr.aria-label]="'DOCS.EDITOR.ATTACHMENT.DOWNLOAD' | translate"
					>
						<nb-icon icon="download-outline"></nb-icon>
					</a>
					<button
						nbButton
						ghost
						size="tiny"
						type="button"
						(click)="openInDocuments()"
						[attr.aria-label]="'DOCS.EDITOR.ATTACHMENT.OPEN' | translate"
					>
						<nb-icon icon="external-link-outline"></nb-icon>
					</button>
				</ng-container>
				<ng-container *ngIf="upload?.status === 'error'">
					<button nbButton ghost size="tiny" status="primary" type="button" (click)="retry()">
						{{ 'DOCS.EDITOR.ATTACHMENT.RETRY' | translate }}
					</button>
					<button nbButton ghost size="tiny" status="danger" type="button" (click)="remove()">
						{{ 'DOCS.EDITOR.ATTACHMENT.REMOVE' | translate }}
					</button>
				</ng-container>
			</div>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.gz-attachment-card {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				margin: 0.375rem 0;
				padding: 0.625rem 0.75rem;
				border: 1px solid var(--border-basic-color-3);
				border-radius: var(--border-radius);
				background: var(--background-basic-color-1);
			}
			.gz-attachment-card.selected {
				outline: 2px solid var(--color-primary-transparent-300);
			}
			.gz-attachment-card.missing {
				opacity: 0.55;
			}
			.gz-attachment-icon {
				font-size: 1.5rem;
				color: var(--text-hint-color);
			}
			.gz-attachment-meta {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
			}
			.gz-attachment-name {
				font-weight: 600;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.gz-attachment-size {
				font-size: 0.75rem;
				color: var(--text-hint-color);
			}
			.gz-attachment-error {
				font-size: 0.75rem;
				color: var(--color-danger-default);
			}
			.gz-attachment-actions {
				display: flex;
				align-items: center;
				gap: 0.125rem;
			}
		`
	]
})
export class FileAttachmentNodeViewComponent extends AngularNodeViewComponent {
	private readonly documentsService = inject(DocumentsService);
	private readonly uploadService = inject(EditorUploadService, { optional: true });
	private readonly router = inject(Router);

	get documentId(): string | null {
		return (this.node().attrs['documentId'] as string | null) ?? null;
	}

	get name(): string {
		return (this.node().attrs['name'] as string) || '';
	}

	get upload(): IEditorUpload | undefined {
		return this.uploadService?.getUpload(this.node().attrs['uploadId'] as string | null);
	}

	/** No documentId and no live upload = orphaned placeholder / deleted target. */
	get isMissing(): boolean {
		return !this.documentId && !this.upload;
	}

	get humanSize(): string {
		const size = Number(this.node().attrs['size'] ?? 0);
		if (!size) return '';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		return `${(size / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
	}

	get icon(): string {
		const mime = (this.node().attrs['mimeType'] as string) || '';
		if (mime.startsWith('image/')) return 'image-outline';
		if (mime.includes('pdf')) return 'file-text-outline';
		if (mime.includes('sheet') || mime.includes('csv')) return 'grid-outline';
		return 'file-outline';
	}

	get downloadHref(): string {
		return this.documentId ? this.documentsService.downloadUrl(this.documentId) : '';
	}

	openInDocuments(): void {
		if (this.documentId) {
			void this.router.navigate(['/pages/documents'], { queryParams: { id: this.documentId } });
		}
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
}
