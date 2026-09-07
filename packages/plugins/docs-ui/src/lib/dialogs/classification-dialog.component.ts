import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { DocumentVisibilityEnum, ID, IDocumentCategory, ITag } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IDocumentUploadOptions } from '../models/docs-api.model';
import { DocumentsService } from '../services/documents.service';

/**
 * What the dialog hands back: the (possibly trimmed) batch plus the options to
 * upload it with. The file list is part of the result because the dialog lets
 * the user drop individual files from the batch — returning only the options
 * would silently upload the files they just removed.
 */
export interface IDocsUploadDialogResult {
	files: File[];
	options: IDocumentUploadOptions;
}

/**
 * Upload & classify dialog (`01-ux-spec.md` §7.2): the queued file list with
 * per-file remove, the destination folder, categories, tags, "classify with AI"
 * and "add to AI knowledge" toggles (defaults from org settings), visibility.
 * Closes with an `IDocsUploadDialogResult` (or `null` on cancel).
 *
 * 🛑 Both toggles are **per-upload overrides of the org defaults**, and both are real
 * `UploadDocumentsDTO` fields (`classifyWithAi`, `importToKnowledge`) that
 * `DocumentsService.uploadMany()` appends to the multipart body. Adding a control here
 * without adding the field on both sides gives the user a switch that does nothing —
 * `classifyWithAi` shipped that way once.
 *
 * The AI-classification toggle is hidden when the deployment reports `aiEnabled: false`
 * (`01-ux-spec.md` §7.2): with no provider the classify stage no-ops, so offering the
 * choice would be a second dead control.
 */
@Component({
	selector: 'gz-docs-classification-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>{{ 'DOCS.UPLOAD.DIALOG_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<div class="docs-dialog-field">
					<label class="label">{{ 'DOCS.UPLOAD.FILES' | translate : { count: files.length } }}</label>
					<div class="docs-upload-files">
						<div class="docs-upload-file" *ngFor="let file of files; trackBy: trackByFile">
							<span class="docs-upload-file-name" [nbTooltip]="file.name">{{ file.name }}</span>
							<span class="docs-upload-file-size">{{ humanize(file.size) }}</span>
							<button
								nbButton
								ghost
								size="tiny"
								[attr.aria-label]="'DOCS.UPLOAD.REMOVE_FILE' | translate : { name: file.name }"
								[nbTooltip]="'DOCS.UPLOAD.REMOVE_FILE' | translate : { name: file.name }"
								(click)="removeFile(file)"
							>
								<nb-icon icon="close-outline" size="tiny"></nb-icon>
							</button>
						</div>
						<div class="hint" *ngIf="!files.length">{{ 'DOCS.UPLOAD.NO_FILES' | translate }}</div>
					</div>
				</div>
				<div class="docs-dialog-field">
					<label class="label">{{ 'DOCS.UPLOAD.DESTINATION' | translate }}</label>
					<gz-docs-folder-picker
						[selectedId]="destinationId"
						(selectedIdChange)="destinationId = $event"
					></gz-docs-folder-picker>
				</div>
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
				<div class="docs-dialog-field" *ngIf="aiEnabled">
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
				<button nbButton status="primary" [disabled]="!files.length" (click)="confirm()">
					{{ 'DOCS.UPLOAD.START' | translate }}
				</button>
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
			.docs-upload-files {
				max-height: 12rem;
				overflow-y: auto;
			}
			.docs-upload-file {
				display: grid;
				grid-template-columns: minmax(0, 1fr) auto auto;
				align-items: center;
				gap: 0.5rem;
				padding: 0.125rem 0;
			}
			.docs-upload-file-name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-upload-file-size {
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
	/** The picked/dropped batch. Editable here — each row has a remove button. */
	@Input() files: File[] = [];
	/** Current tree location — seeds the destination picker (`01-ux-spec.md` §7.2). */
	@Input() parentId: ID | null = null;

	public categories: IDocumentCategory[] = [];
	public categoryIds: ID[] = [];
	public tags: ITag[] = [];
	public classifyWithAi = true;
	public importToKnowledge = false;
	public visibility: DocumentVisibilityEnum = DocumentVisibilityEnum.ORGANIZATION;
	public readonly visibilityEnum = DocumentVisibilityEnum;
	/** Optimistic until `GET /settings` answers — a settings failure must not hide the toggle. */
	public aiEnabled = true;
	/** Chosen destination; seeded from `parentId` so the default is "here". */
	public destinationId: ID | null = null;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<ClassificationDialogComponent>,
		private readonly documentsService: DocumentsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// A caller that opens the dialog without a context array must still get a
		// mutable list — `removeFile` splices this one.
		this.files = [...(this.files ?? [])];
		this.destinationId = this.parentId ?? null;
		this.documentsService
			.getCategories()
			.pipe(catchError(() => of([])))
			.subscribe((categories) => (this.categories = categories ?? []));
		// Seed the toggles from the org defaults (fail silently — the server applies the very
		// same defaults for any field this dialog ends up not sending).
		this.documentsService
			.getSettings()
			.pipe(catchError(() => of(null)))
			.subscribe((settings) => {
				if (settings?.defaults) {
					this.classifyWithAi = settings.defaults.autoClassify;
					this.importToKnowledge = settings.defaults.importToKnowledgeDefault;
					this.visibility = settings.defaults.defaultVisibility ?? this.visibility;
				}
				if (typeof settings?.capabilities?.aiEnabled === 'boolean') {
					this.aiEnabled = settings.capabilities.aiEnabled;
				}
			});
	}

	trackByFile(index: number, file: File): string {
		return `${index}:${file.name}:${file.size}`;
	}

	/** Drops one file from the batch; emptying the list disables Upload. */
	removeFile(file: File): void {
		const index = this.files.indexOf(file);
		if (index >= 0) this.files = this.files.filter((_, position) => position !== index);
	}

	/** Same rounding as the progress strip and the detail panel. */
	humanize(bytes: number): string {
		if (!bytes) return '';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	confirm(): void {
		if (!this.files.length) return;
		const options: IDocumentUploadOptions = {
			parentId: this.destinationId,
			categoryIds: this.categoryIds,
			tagIds: (this.tags ?? []).map((tag) => tag.id as ID),
			classifyWithAi: this.classifyWithAi,
			importToKnowledge: this.importToKnowledge,
			visibility: this.visibility
		};
		this.dialogRef.close({ files: this.files, options });
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
