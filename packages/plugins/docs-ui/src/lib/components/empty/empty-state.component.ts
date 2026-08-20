import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { DOCS_PERMISSIONS } from '../../docs-permission-groups';

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
				<div class="docs-empty-actions" *ngxPermissionsOnly="docsPermissions.create">
					<button nbButton size="small" status="primary" (click)="primaryAction.emit('upload')">
						{{ 'DOCS.UPLOAD.BUTTON' | translate }}
					</button>
					<button nbButton size="small" appearance="outline" (click)="primaryAction.emit('new-page')">
						{{ 'DOCS.TREE.NEW_PAGE' | translate }}
					</button>
					<!-- First run is exactly the state where no node exists to hang a "New
					     folder" context menu off, so this is the only path to the first folder. -->
					<button nbButton size="small" appearance="outline" (click)="primaryAction.emit('new-folder')">
						{{ 'DOCS.TREE.NEW_FOLDER' | translate }}
					</button>
				</div>
			</ng-container>

			<ng-container *ngSwitchCase="'empty-folder'">
				<nb-icon icon="folder-outline" class="docs-empty-icon"></nb-icon>
				<h6>{{ 'DOCS.EMPTY.FOLDER' | translate }}</h6>
				<div class="docs-empty-actions" *ngxPermissionsOnly="docsPermissions.create">
					<button nbButton size="small" (click)="primaryAction.emit('new-page')">
						{{ 'DOCS.TREE.NEW_PAGE' | translate }}
					</button>
					<!-- A sub-folder is created into the folder currently being viewed. -->
					<button nbButton size="small" (click)="primaryAction.emit('new-folder')">
						{{ 'DOCS.TREE.NEW_FOLDER' | translate }}
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
			:host {
				display: block;
				width: 100%;
			}
			.docs-empty {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				padding: 2rem 1.25rem;
				text-align: center;
				color: var(--docs-text-muted, var(--text-hint-color));
			}
			.docs-empty h6 {
				margin: 0;
				font-size: var(--docs-body-size, 0.8125rem);
				font-weight: 600;
				color: var(--docs-text, var(--text-basic-color));
			}
			.docs-empty p {
				margin: 0;
				max-width: 26rem;
				font-size: var(--docs-meta-size, 0.75rem);
			}
			.docs-empty-icon {
				font-size: 2rem;
				color: var(--docs-text-muted, var(--text-hint-color));
				opacity: 0.75;
			}
			.docs-empty-icon.success {
				color: var(--color-success-default);
				opacity: 1;
			}
			.docs-empty-icon.danger {
				color: var(--color-danger-default);
				opacity: 1;
			}
			.docs-empty-actions {
				display: flex;
				flex-wrap: wrap;
				justify-content: center;
				gap: 0.375rem;
				margin-top: 0.25rem;
			}
			.docs-empty button[nbButton] {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				height: var(--docs-control-height, 2rem);
				min-height: var(--docs-control-height, 2rem);
				padding-inline: 0.75rem;
				border-radius: var(--docs-radius, 0.375rem);
				font-size: var(--docs-body-size, 0.8125rem);
				font-weight: 500;
			}
		`
	],
	standalone: false
})
export class EmptyStateComponent {
	@Input() variant: DocsEmptyVariant = 'first-run';
	@Output() primaryAction = new EventEmitter<string>();

	public readonly permissions = PermissionsEnum;

	/**
	 * Stable permission arrays for the template's `*ngxPermissionsOnly` gates.
	 * 🛑 Never inline `[permissions.X]` in a binding — a fresh array each change-detection cycle
	 * makes ngx-permissions re-validate forever and wedges the main thread.
	 */
	public readonly docsPermissions = DOCS_PERMISSIONS;
}
