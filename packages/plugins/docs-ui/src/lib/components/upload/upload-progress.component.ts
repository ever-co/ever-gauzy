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
						<!-- Dedup notice (R-UPL-04) — advisory only, the upload still went through -->
						<span class="docs-upload-duplicate" *ngIf="item.duplicateOfId">
							<nb-icon icon="copy-outline" size="tiny"></nb-icon>
							{{
								item.duplicateOfName
									? ('DOCS.UPLOAD.DUPLICATE_NOTICE' | translate : { name: item.duplicateOfName })
									: ('DOCS.UPLOAD.DUPLICATE_NOTICE_UNKNOWN' | translate)
							}}
						</span>
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
			:host {
				display: block;
				min-width: 0;
			}
			/* Ring + surface: the same panel chrome the table, the cards and the
			   stats tiles carry, instead of Nebular's default card border. */
			.docs-upload-progress {
				margin: 0;
				border: 0;
				border-radius: var(--docs-radius-lg, 0.5rem);
				background: var(--docs-surface, var(--background-basic-color-1));
				box-shadow: inset 0 0 0 1px var(--docs-hairline, rgba(126, 126, 143, 0.18));
			}
			.docs-upload-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				font-size: var(--docs-label-size, 0.6875rem);
				font-weight: 600;
				letter-spacing: 0.02em;
				text-transform: uppercase;
				color: var(--docs-text-muted, var(--text-hint-color));
			}
			.docs-upload-progress nb-card-body {
				padding: 0.25rem 0.75rem 0.5rem;
			}
			.docs-upload-row {
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(6rem, 12rem) auto;
				align-items: center;
				gap: 0.75rem;
				padding: 0.25rem 0;
				font-size: var(--docs-body-size, 0.8125rem);
			}
			.docs-upload-meta {
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				min-width: 0;
			}
			.docs-upload-name {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-upload-size {
				flex: 0 0 auto;
				color: var(--docs-text-muted, var(--text-hint-color));
				font-size: var(--docs-meta-size, 0.75rem);
				font-variant-numeric: tabular-nums;
			}
			.docs-upload-duplicate {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				min-width: 0;
				color: var(--color-warning-default);
				font-size: var(--docs-meta-size, 0.75rem);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.docs-upload-state {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				font-size: var(--docs-meta-size, 0.75rem);
				white-space: nowrap;
			}
			.docs-upload-state.done {
				color: var(--color-success-default);
			}
			.docs-upload-state.error {
				color: var(--color-danger-default);
			}
			.docs-upload-actions {
				display: inline-flex;
				align-items: center;
				justify-content: flex-end;
				gap: 0.125rem;
			}
			.docs-upload-progress button[nbButton] {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				height: 1.5rem;
				min-height: 1.5rem;
				padding-inline: 0.375rem;
				border-radius: var(--docs-radius, 0.375rem);
				font-size: var(--docs-meta-size, 0.75rem);
			}
			.docs-upload-progress button[nbButton] nb-icon {
				margin: 0;
				font-size: 0.875rem;
			}
			/* Below the sm breakpoint the three tracks stop fitting: the progress
			   bar and the state line drop under the file name instead of
			   crushing it. */
			@media (max-width: 575px) {
				.docs-upload-row {
					grid-template-columns: minmax(0, 1fr) auto;
				}
				.docs-upload-row nb-progress-bar,
				.docs-upload-row .docs-upload-state {
					grid-column: 1 / -1;
				}
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
