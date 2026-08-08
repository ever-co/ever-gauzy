import { Component, Input } from '@angular/core';
import { DocumentStatusEnum, IDocument, PermissionsEnum } from '@gauzy/contracts';

/**
 * Processing status badge. UPLOADED folds into the "Processing" style with an
 * inline spinner; FAILED renders a red dot with the statusMessage tooltip and
 * an inline Retry link for DOCS_UPDATE holders.
 */
@Component({
	selector: 'gz-docs-status-badge',
	template: `
		<span class="docs-badge" [ngClass]="cssClass" [nbTooltip]="tooltip" nbTooltipStatus="basic">
			<nb-icon *ngIf="isProcessing" icon="loader-outline" size="tiny" class="docs-badge-spin"></nb-icon>
			<span class="docs-badge-dot" *ngIf="!isProcessing"></span>
			{{ labelKey | translate }}
			<a
				*ngxPermissionsOnly="[permissions.DOCS_UPDATE]"
				class="docs-badge-retry"
				href="javascript:void(0)"
				(click)="onRetry($event)"
				[hidden]="status !== statusEnum.FAILED"
				>{{ 'DOCS.UPLOAD.RETRY' | translate }}</a
			>
		</span>
	`,
	styles: [
		`
			.docs-badge {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 0.75rem;
				border-radius: 1rem;
				padding: 0.125rem 0.5rem;
				background: var(--background-basic-color-2);
			}
			.docs-badge-dot {
				width: 0.5rem;
				height: 0.5rem;
				border-radius: 50%;
				background: currentColor;
			}
			.docs-badge.ready {
				color: var(--color-success-default);
			}
			.docs-badge.failed {
				color: var(--color-danger-default);
			}
			.docs-badge.processing {
				color: var(--color-info-default);
			}
			.docs-badge-spin {
				animation: docs-spin 1s linear infinite;
			}
			@keyframes docs-spin {
				to {
					transform: rotate(360deg);
				}
			}
			.docs-badge-retry {
				margin-left: 0.25rem;
			}
		`
	],
	standalone: false
})
export class StatusBadgeComponent {
	@Input() rowData: IDocument;
	@Input() value: DocumentStatusEnum;

	/** Set by the table's onComponentInitFunction to route Retry clicks. */
	public retryHandler?: (document: IDocument) => void;

	public readonly statusEnum = DocumentStatusEnum;
	public readonly permissions = PermissionsEnum;

	get status(): DocumentStatusEnum {
		return this.value ?? this.rowData?.status;
	}

	get isProcessing(): boolean {
		return this.status === DocumentStatusEnum.UPLOADED || this.status === DocumentStatusEnum.PROCESSING;
	}

	get cssClass(): string {
		if (this.isProcessing) return 'processing';
		return this.status === DocumentStatusEnum.READY ? 'ready' : 'failed';
	}

	get labelKey(): string {
		return `DOCS.STATUS.${this.isProcessing ? 'PROCESSING' : this.status}`;
	}

	get tooltip(): string {
		return this.status === DocumentStatusEnum.FAILED ? this.rowData?.statusMessage ?? '' : '';
	}

	onRetry(event: Event): void {
		event.stopPropagation();
		if (this.rowData && this.retryHandler) this.retryHandler(this.rowData);
	}
}
