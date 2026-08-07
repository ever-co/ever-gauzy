import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadQueueItem } from '../../services/upload-queue.service';

/**
 * Per-file upload rows: name, size, progress bar, done/error state, retry,
 * dismiss and clear-finished.
 */
@Component({
	selector: 'gz-docs-upload-progress',
	template: `
		<nb-card class="docs-upload-progress" *ngIf="items?.length" [attr.aria-label]="'DOCS.A11Y.UPLOAD_PROGRESS' | translate">
			<nb-card-header class="docs-upload-header">
				<span>{{ 'DOCS.UPLOAD.BUTTON' | translate }}</span>
				<button nbButton ghost size="tiny" (click)="clearFinished.emit()">
					{{ 'DOCS.UPLOAD.CLEAR_FINISHED' | translate }}
				</button>
			</nb-card-header>
			<nb-card-body>
				<div class="docs-upload-row" *ngFor="let item of items; trackBy: trackByKey">
					<div class="docs-upload-meta">
						<span class="docs-upload-name" [nbTooltip]="item.file.name">{{ item.file.name }}</span>
						<span class="docs-upload-size">{{ humanize(item.file.size) }}</span>
					</div>
					<nb-progress-bar
						*ngIf="item.state === 'uploading'"
						[value]="item.progress"
						status="primary"
						size="tiny"
					></nb-progress-bar>
					<span class="docs-upload-state done" *ngIf="item.state === 'done'">
						<nb-icon icon="checkmark-circle-2-outline" size="tiny"></nb-icon>
						{{ 'DOCS.UPLOAD.PROGRESS_DONE' | translate }}
					</span>
					<span class="docs-upload-state error" *ngIf="item.state === 'error'" [nbTooltip]="item.error || ''">
						<nb-icon icon="alert-triangle-outline" size="tiny"></nb-icon>
						{{ 'DOCS.UPLOAD.PROGRESS_ERROR' | translate }}
					</span>
					<span class="docs-upload-actions">
						<button *ngIf="item.state === 'error'" nbButton ghost size="tiny" (click)="retry.emit(item.key)">
							{{ 'DOCS.UPLOAD.RETRY' | translate }}
						</button>
						<button nbButton ghost size="tiny" (click)="dismiss.emit(item.key)">
							<nb-icon icon="close-outline" size="tiny"></nb-icon>
						</button>
					</span>
				</div>
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.docs-upload-progress {
				margin-bottom: 1rem;
			}
			.docs-upload-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.docs-upload-row {
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(6rem, 12rem) auto;
				align-items: center;
				gap: 0.75rem;
				padding: 0.25rem 0;
			}
			.docs-upload-meta {
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				min-width: 0;
			}
			.docs-upload-name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-upload-size {
				color: var(--text-hint-color);
				font-size: 0.75rem;
			}
			.docs-upload-state.done {
				color: var(--color-success-default);
			}
			.docs-upload-state.error {
				color: var(--color-danger-default);
			}
			.docs-upload-actions {
				display: inline-flex;
				gap: 0.25rem;
			}
		`
	],
	standalone: false
})
export class UploadProgressComponent {
	@Input() items: UploadQueueItem[] | null = [];
	@Output() retry = new EventEmitter<string>();
	@Output() dismiss = new EventEmitter<string>();
	@Output() clearFinished = new EventEmitter<void>();

	trackByKey(_: number, item: UploadQueueItem): string {
		return item.key;
	}

	humanize(bytes: number): string {
		if (!bytes) return '';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}
}
