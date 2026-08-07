import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { DocumentVisibilityEnum, ID, IDocumentCategory, ITag } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IDocumentUploadOptions } from '../models/docs-api.model';
import { DocumentsService } from '../services/documents.service';

/**
 * Post-pick, pre-upload options: categories, tags, "classify with AI" and
 * "add to AI knowledge" toggles (defaults from org settings), visibility.
 * Closes with an `IDocumentUploadOptions` (or `null` on cancel); "Upload with
 * defaults" skips straight through.
 */
@Component({
	selector: 'gz-docs-classification-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>{{ 'DOCS.UPLOAD.DIALOG_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<div class="docs-dialog-field">
					<label class="label">{{ 'DOCS.UPLOAD.CATEGORIES' | translate }}</label>
					<nb-select multiple fullWidth size="small" [(selected)]="categoryIds">
						<nb-option *ngFor="let category of categories" [value]="category.id">{{ category.name }}</nb-option>
					</nb-select>
				</div>
				<div class="docs-dialog-field">
					<label class="label">{{ 'DOCS.UPLOAD.TAGS' | translate }}</label>
					<ga-tags-color-input
						[multiple]="true"
						[isOrgLevel]="true"
						[selectedTags]="tags"
						(selectedTagsEvent)="tags = $event"
					></ga-tags-color-input>
				</div>
				<div class="docs-dialog-field">
					<nb-toggle [(checked)]="classifyWithAi" labelPosition="end">
						{{ 'DOCS.UPLOAD.AI_CLASSIFY_TOGGLE' | translate }}
					</nb-toggle>
					<div class="hint">{{ 'DOCS.UPLOAD.AI_CLASSIFY_HINT' | translate }}</div>
				</div>
				<div class="docs-dialog-field">
					<nb-toggle [(checked)]="importToKnowledge" labelPosition="end">
						{{ 'DOCS.UPLOAD.KNOWLEDGE_TOGGLE' | translate }}
					</nb-toggle>
					<div class="hint">{{ 'DOCS.UPLOAD.KNOWLEDGE_HINT' | translate }}</div>
				</div>
				<div class="docs-dialog-field">
					<label class="label">{{ 'DOCS.UPLOAD.VISIBILITY' | translate }}</label>
					<nb-select fullWidth size="small" [(selected)]="visibility">
						<nb-option [value]="visibilityEnum.ORGANIZATION">{{ 'DOCS.VISIBILITY.ORGANIZATION' | translate }}</nb-option>
						<nb-option [value]="visibilityEnum.PRIVATE">{{ 'DOCS.VISIBILITY.PRIVATE' | translate }}</nb-option>
					</nb-select>
				</div>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" (click)="confirm()">{{ 'DOCS.UPLOAD.START' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-dialog {
				min-width: 24rem;
				max-width: 32rem;
			}
			.docs-dialog-field {
				margin-bottom: 1rem;
			}
			.docs-dialog-field .label {
				display: block;
				margin-bottom: 0.25rem;
			}
			.docs-dialog-field .hint {
				font-size: 0.75rem;
				color: var(--text-hint-color);
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
export class ClassificationDialogComponent extends TranslationBaseComponent implements OnInit {
	@Input() parentId: ID | null = null;

	public categories: IDocumentCategory[] = [];
	public categoryIds: ID[] = [];
	public tags: ITag[] = [];
	public classifyWithAi = true;
	public importToKnowledge = false;
	public visibility: DocumentVisibilityEnum = DocumentVisibilityEnum.ORGANIZATION;
	public readonly visibilityEnum = DocumentVisibilityEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<ClassificationDialogComponent>,
		private readonly documentsService: DocumentsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.documentsService
			.getCategories()
			.pipe(catchError(() => of([])))
			.subscribe((categories) => (this.categories = categories ?? []));
		// Defaults from org settings (cosmetic; fail silently).
		this.documentsService
			.getSettings()
			.pipe(catchError(() => of(null)))
			.subscribe((settings) => {
				if (settings?.defaults) {
					this.classifyWithAi = settings.defaults.autoClassify;
					this.importToKnowledge = settings.defaults.importToKnowledgeDefault;
					this.visibility = settings.defaults.defaultVisibility ?? this.visibility;
				}
			});
	}

	confirm(): void {
		const options: IDocumentUploadOptions = {
			parentId: this.parentId,
			categoryIds: this.categoryIds,
			tagIds: (this.tags ?? []).map((tag) => tag.id as ID),
			classifyWithAi: this.classifyWithAi,
			importToKnowledge: this.importToKnowledge,
			visibility: this.visibility
		};
		this.dialogRef.close(options);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
