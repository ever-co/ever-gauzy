import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { ID, IDocumentCategory } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsService } from '../services/documents.service';

/**
 * Bulk "Set categories" dialog (`R-BLK-01` / `01-ux-spec.md` §12).
 *
 * 🛑 The bulk action is `SET_CATEGORIES` — a **replace**, not a merge: every
 * selected document ends up with exactly the categories chosen here and loses
 * the rest. Tags have separate add/remove actions precisely because they are
 * additive; categories do not, so the dialog leads with the warning rather than
 * burying it in a hint. Confirming with nothing selected clears the category set
 * of every selected document, which is a legitimate (and equally destructive)
 * use of the same action.
 *
 * Closes with `ID[]` on confirm, `null` on cancel.
 */
@Component({
	selector: 'gz-docs-bulk-categories-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>{{ 'DOCS.BULK.CATEGORIES' | translate }}</nb-card-header>
			<nb-card-body>
				<div class="docs-dialog-warning">
					<nb-icon icon="alert-triangle-outline"></nb-icon>
					<span>{{ 'DOCS.DIALOGS.SET_CATEGORIES_WARNING' | translate }}</span>
				</div>
				<div class="docs-dialog-field">
					<label class="label">{{ 'DOCS.DETAIL.CATEGORIES' | translate }}</label>
					<nb-select multiple fullWidth size="small" [(selected)]="categoryIds">
						<nb-option *ngFor="let category of categories" [value]="category.id">{{ category.name }}</nb-option>
					</nb-select>
					<div class="hint">{{ 'DOCS.BULK.SET_CATEGORIES_HINT' | translate }}</div>
				</div>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" (click)="confirm()">{{ 'DOCS.BULK.CATEGORIES' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-dialog {
				min-width: 22rem;
				max-width: 30rem;
			}
			.docs-dialog-warning {
				display: flex;
				align-items: flex-start;
				gap: 0.5rem;
				margin-bottom: 1rem;
				color: var(--color-warning-default);
			}
			.docs-dialog-field .label {
				display: block;
				margin-bottom: 0.25rem;
			}
			.docs-dialog-field .hint {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				margin-top: 0.25rem;
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	],
	standalone: false
})
export class BulkCategoriesDialogComponent extends TranslationBaseComponent implements OnInit {
	public categories: IDocumentCategory[] = [];
	public categoryIds: ID[] = [];

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<BulkCategoriesDialogComponent>,
		private readonly documentsService: DocumentsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Cosmetic fetch: an empty catalog still lets the user clear categories.
		this.documentsService
			.getCategories()
			.pipe(catchError(() => of([])))
			.subscribe((categories) => (this.categories = categories ?? []));
	}

	confirm(): void {
		this.dialogRef.close(this.categoryIds ?? []);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
