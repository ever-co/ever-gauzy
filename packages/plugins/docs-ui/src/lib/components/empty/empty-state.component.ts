import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PermissionsEnum } from '@gauzy/contracts';

export type DocsEmptyVariant = 'first-run' | 'empty-folder' | 'no-results' | 'review-empty' | 'error';

/**
 * Variant-driven empty/error states per `01-ux-spec.md` §13.
 */
@Component({
	selector: 'gz-docs-empty-state',
	template: `
		<div class="docs-empty" [ngSwitch]="variant">
			<ng-container *ngSwitchCase="'first-run'">
				<nb-icon icon="file-add-outline" class="docs-empty-icon"></nb-icon>
				<h6>{{ 'DOCS.EMPTY.NO_DOCUMENTS' | translate }}</h6>
				<p>{{ 'DOCS.EMPTY.NO_DOCUMENTS_CTA' | translate }}</p>
				<div class="docs-empty-actions" *ngxPermissionsOnly="[permissions.DOCS_CREATE]">
					<button nbButton size="small" status="primary" (click)="primaryAction.emit('upload')">
						{{ 'DOCS.UPLOAD.BUTTON' | translate }}
					</button>
					<button nbButton size="small" appearance="outline" (click)="primaryAction.emit('new-page')">
						{{ 'DOCS.TREE.NEW_PAGE' | translate }}
					</button>
				</div>
			</ng-container>

			<ng-container *ngSwitchCase="'empty-folder'">
				<nb-icon icon="folder-outline" class="docs-empty-icon"></nb-icon>
				<h6>{{ 'DOCS.EMPTY.FOLDER' | translate }}</h6>
				<div class="docs-empty-actions" *ngxPermissionsOnly="[permissions.DOCS_CREATE]">
					<button nbButton size="small" (click)="primaryAction.emit('new-page')">
						{{ 'DOCS.TREE.NEW_PAGE' | translate }}
					</button>
					<button nbButton size="small" (click)="primaryAction.emit('upload')">
						{{ 'DOCS.TREE.UPLOAD_HERE' | translate }}
					</button>
				</div>
			</ng-container>

			<ng-container *ngSwitchCase="'no-results'">
				<nb-icon icon="search-outline" class="docs-empty-icon"></nb-icon>
				<h6>{{ 'DOCS.EMPTY.FILTERED' | translate }}</h6>
				<button nbButton ghost size="small" (click)="primaryAction.emit('clear-filters')">
					{{ 'DOCS.EMPTY.FILTERED_CTA' | translate }}
				</button>
			</ng-container>

			<ng-container *ngSwitchCase="'review-empty'">
				<nb-icon icon="checkmark-circle-2-outline" class="docs-empty-icon success"></nb-icon>
				<h6>{{ 'DOCS.REVIEW.EMPTY' | translate }}</h6>
			</ng-container>

			<ng-container *ngSwitchCase="'error'">
				<nb-icon icon="alert-triangle-outline" class="docs-empty-icon danger"></nb-icon>
				<h6>{{ 'DOCS.ERRORS.LIST_LOAD' | translate }}</h6>
				<button nbButton size="small" status="primary" (click)="primaryAction.emit('retry')">
					{{ 'DOCS.ERRORS.GENERIC_RETRY' | translate }}
				</button>
			</ng-container>
		</div>
	`,
	styles: [
		`
			.docs-empty {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				padding: 3rem 1rem;
				text-align: center;
				color: var(--text-hint-color);
			}
			.docs-empty-icon {
				font-size: 2.5rem;
			}
			.docs-empty-icon.success {
				color: var(--color-success-default);
			}
			.docs-empty-icon.danger {
				color: var(--color-danger-default);
			}
			.docs-empty-actions {
				display: flex;
				gap: 0.5rem;
			}
		`
	],
	standalone: false
})
export class EmptyStateComponent {
	@Input() variant: DocsEmptyVariant = 'first-run';
	@Output() primaryAction = new EventEmitter<string>();

	public readonly permissions = PermissionsEnum;
}
