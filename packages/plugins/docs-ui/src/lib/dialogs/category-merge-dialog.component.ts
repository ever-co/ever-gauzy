import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ID, IDocumentCategory } from '@gauzy/contracts';

/**
 * Merge a category into another (`POST /categories/:id/merge`): every document
 * assignment is re-pointed to the target and the source is soft-deleted. The
 * source itself is excluded from the target list — the backend rejects a
 * self-merge with a 400 and there is no reason to offer it.
 */
@Component({
	selector: 'gz-docs-category-merge-dialog',
	imports: [CommonModule, FormsModule, TranslateModule, NbButtonModule, NbCardModule, NbSelectModule],
	template: `
		<nb-card class="docs-dialog docs-category-merge-dialog">
			<nb-card-header>{{ 'DOCS.SETTINGS.MERGE_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="hint">{{ 'DOCS.SETTINGS.MERGE_HINT' | translate : { name: source?.name } }}</p>
				<label class="label">{{ 'DOCS.SETTINGS.MERGE_TARGET' | translate }}</label>
				<nb-select fullWidth [(selected)]="targetId">
					<nb-option *ngFor="let category of targets" [value]="category.id">
						{{ category.name }}
					</nb-option>
				</nb-select>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" [disabled]="!targetId" (click)="confirm()">
					{{ 'DOCS.SETTINGS.MERGE_CONFIRM' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-category-merge-dialog {
				width: 26rem;
				max-width: 90vw;
			}
			.label {
				display: block;
				margin: 0.75rem 0 0.25rem;
			}
			.hint {
				color: var(--text-hint-color);
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class CategoryMergeDialogComponent {
	/** Category being merged away. */
	@Input() source: IDocumentCategory | null = null;
	/** Candidate targets (the caller filters the source out). */
	@Input() targets: IDocumentCategory[] = [];

	public targetId: ID | null = null;

	constructor(private readonly dialogRef: NbDialogRef<CategoryMergeDialogComponent>) {}

	confirm(): void {
		if (!this.targetId) return;
		this.dialogRef.close(this.targetId);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
