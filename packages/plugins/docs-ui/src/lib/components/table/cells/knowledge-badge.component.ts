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
			.docs-badge {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 0.75rem;
				border-radius: 1rem;
				padding: 0.125rem 0.5rem;
				background: var(--background-basic-color-2);
				color: var(--text-hint-color);
			}
			.docs-badge.indexed {
				color: var(--color-primary-default);
			}
			.docs-badge.failed {
				color: var(--color-danger-default);
			}
			.docs-badge.excluded {
				border: 1px solid var(--border-basic-color-4);
				background: transparent;
			}
			.docs-badge.review-pill {
				color: var(--color-warning-default);
				margin-left: 0.25rem;
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
