import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { IDocumentCategory } from '@gauzy/contracts';

/** What the dialog resolves with on confirm (`null` on cancel). */
export type IDocsCategoryDialogResult = Pick<IDocumentCategory, 'name' | 'color' | 'description'>;

/**
 * Create / rename a document category (`03-backend-plugin.md` §4.11). Standalone
 * so the settings page — which is lazily loaded outside `DocsUiModule` — can use
 * it without pulling the whole browse chunk.
 *
 * `slug` is deliberately never edited here: the backend derives it on create and
 * treats it as immutable for `isSystem` rows.
 */
@Component({
	selector: 'gz-docs-category-dialog',
	imports: [CommonModule, FormsModule, TranslateModule, NbButtonModule, NbCardModule, NbInputModule],
	template: `
		<nb-card class="docs-dialog docs-category-dialog">
			<nb-card-header>
				{{ (category ? 'DOCS.SETTINGS.CATEGORY_EDIT' : 'DOCS.SETTINGS.CATEGORY_NEW') | translate }}
			</nb-card-header>
			<nb-card-body>
				<label class="label" for="docs-category-name">{{ 'DOCS.SETTINGS.CATEGORY_NAME' | translate }}</label>
				<input
					id="docs-category-name"
					nbInput
					fullWidth
					type="text"
					maxlength="100"
					[(ngModel)]="name"
					(keydown.enter)="confirm()"
				/>

				<label class="label" for="docs-category-color">{{ 'DOCS.SETTINGS.CATEGORY_COLOR' | translate }}</label>
				<input id="docs-category-color" nbInput fullWidth type="color" [(ngModel)]="color" />

				<label class="label" for="docs-category-description">
					{{ 'DOCS.SETTINGS.CATEGORY_DESCRIPTION' | translate }}
				</label>
				<textarea
					id="docs-category-description"
					nbInput
					fullWidth
					rows="2"
					maxlength="255"
					[(ngModel)]="description"
				></textarea>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" [disabled]="!name?.trim()" (click)="confirm()">
					{{ 'DOCS.DIALOGS.CREATE_CONFIRM' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-category-dialog {
				width: 26rem;
				max-width: 90vw;
			}
			.label {
				display: block;
				margin: 0.75rem 0 0.25rem;
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class CategoryDialogComponent implements OnInit {
	/** Existing row to edit; omit to create. */
	@Input() category: IDocumentCategory | null = null;

	public name = '';
	public color = '#3366ff';
	public description = '';

	constructor(private readonly dialogRef: NbDialogRef<CategoryDialogComponent>) {}

	ngOnInit(): void {
		if (this.category) {
			this.name = this.category.name ?? '';
			this.color = this.category.color || '#3366ff';
			this.description = this.category.description ?? '';
		}
	}

	confirm(): void {
		const name = this.name?.trim();
		if (!name) return;
		const result: IDocsCategoryDialogResult = {
			name,
			color: this.color || undefined,
			description: this.description?.trim() || undefined
		};
		this.dialogRef.close(result);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
