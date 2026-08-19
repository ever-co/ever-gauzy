import { Component, Input } from '@angular/core';
import { DocumentKnowledgeStatusEnum, DocumentReviewStatusEnum, IDocument } from '@gauzy/contracts';

/**
 * AI knowledge badge; a PENDING review overlays the amber review pill next to it.
 */
@Component({
	selector: 'gz-docs-knowledge-badge',
	template: `
		<span class="docs-badge" [ngClass]="cssClass">
			<nb-icon *ngIf="isBusy" icon="loader-outline" size="tiny" class="docs-badge-spin"></nb-icon>
			{{ 'DOCS.KNOWLEDGE.' + status | translate }}
		</span>
		<span
			class="docs-badge review-pill"
			*ngIf="rowData?.reviewStatus === reviewEnum.PENDING"
			[nbTooltip]="'DOCS.REVIEW.PENDING_TOOLTIP' | translate"
		>
			{{ 'DOCS.REVIEW.PENDING' | translate }}
		</span>
	`,
	styles: [
		`
			/* One badge geometry shared with the knowledge badge and the detail
			   panel: the table's badge height token, the theme's control radius,
			   and a single line box — a status pill must cost a row no more than
			   the text beside it. */
			.docs-badge {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				max-width: 100%;
				height: var(--gauzy-table-badge-height, 1.25rem);
				padding: 0 var(--gauzy-table-chip-padding-x, 0.375rem);
				border-radius: var(--docs-radius, 0.375rem);
				font-size: var(--gauzy-table-chip-font-size, 0.6875rem);
				line-height: 1;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				background: var(--docs-surface-sunken, var(--background-basic-color-2));
			}
			.docs-badge {
				color: var(--docs-text-muted, var(--text-hint-color));
			}
			.docs-badge.indexed {
				color: var(--color-primary-default);
			}
			.docs-badge.failed {
				color: var(--color-danger-default);
			}
			.docs-badge.excluded {
				box-shadow: inset 0 0 0 1px var(--border-basic-color-4);
				background: transparent;
			}
			.docs-badge.review-pill {
				color: var(--color-warning-default);
				margin-left: 0.25rem;
			}
			.docs-badge nb-icon {
				font-size: 0.75rem;
			}
			.docs-badge-spin {
				animation: docs-spin 1s linear infinite;
			}
			@keyframes docs-spin {
				to {
					transform: rotate(360deg);
				}
			}
		`
	],
	standalone: false
})
export class KnowledgeBadgeComponent {
	@Input() rowData: IDocument;
	@Input() value: DocumentKnowledgeStatusEnum;

	public readonly reviewEnum = DocumentReviewStatusEnum;

	get status(): DocumentKnowledgeStatusEnum {
		return this.value ?? this.rowData?.knowledgeStatus ?? DocumentKnowledgeStatusEnum.NONE;
	}

	get isBusy(): boolean {
		return this.status === DocumentKnowledgeStatusEnum.QUEUED || this.status === DocumentKnowledgeStatusEnum.INDEXING;
	}

	get cssClass(): string {
		switch (this.status) {
			case DocumentKnowledgeStatusEnum.INDEXED:
				return 'indexed';
			case DocumentKnowledgeStatusEnum.FAILED:
				return 'failed';
			case DocumentKnowledgeStatusEnum.EXCLUDED:
				return 'excluded';
			default:
				return '';
		}
	}
}
