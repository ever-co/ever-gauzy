import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
		<nb-card class="docs-upload-dialog">
			<nb-card-header class="docs-upload-dialog-header">
				<span class="docs-upload-dialog-title">{{ 'DOCS.UPLOAD.DIALOG_TITLE' | translate }}</span>
				<button
					nbButton
					ghost
					size="small"
					class="docs-upload-dialog-close"
					[attr.aria-label]="'DOCS.UPLOAD.CANCEL' | translate"
					(click)="cancel()"
				>
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</nb-card-header>

			<nb-card-body class="docs-upload-dialog-body">
				<!-- Files -->
				<section class="docs-upload-section">
					<label class="docs-upload-label">{{ 'DOCS.UPLOAD.FILES' | translate: { count: files.length } }}</label>
					<div class="docs-upload-files">
						@for (file of files; track trackByFile($index, file)) {
							<div class="docs-upload-file">
								<nb-icon class="docs-upload-file-icon" icon="file-outline"></nb-icon>
								<span class="docs-upload-file-name" [nbTooltip]="file.name">{{ file.name }}</span>
								<span class="docs-upload-file-size">{{ humanize(file.size) }}</span>
								<button
									nbButton
									ghost
									size="tiny"
									class="docs-upload-file-remove"
									[attr.aria-label]="'DOCS.UPLOAD.REMOVE_FILE' | translate: { name: file.name }"
									[nbTooltip]="'DOCS.UPLOAD.REMOVE_FILE' | translate: { name: file.name }"
									(click)="removeFile(file)"
								>
									<nb-icon icon="close-outline"></nb-icon>
								</button>
							</div>
						}
						@if (!files.length) {
							<div class="docs-upload-files-empty">{{ 'DOCS.UPLOAD.NO_FILES' | translate }}</div>
						}
					</div>
				</section>

				<!-- Destination -->
				<section class="docs-upload-section">
					<label class="docs-upload-label">{{ 'DOCS.UPLOAD.DESTINATION' | translate }}</label>
					<gz-docs-folder-picker
						[selectedId]="destinationId"
						(selectedIdChange)="destinationId = $event"
					></gz-docs-folder-picker>
				</section>

				<!-- Classification: categories and visibility side by side, tags below -->
				<section class="docs-upload-section docs-upload-grid">
					<div class="docs-upload-field">
						<label class="docs-upload-label">{{ 'DOCS.UPLOAD.CATEGORIES' | translate }}</label>
						<nb-select
							multiple
							fullWidth
							size="small"
							[placeholder]="'DOCS.UPLOAD.CATEGORIES' | translate"
							[(selected)]="categoryIds"
						>
							@for (category of categories; track category) {
								<nb-option [value]="category.id">{{ category.name }}</nb-option>
							}
						</nb-select>
					</div>
					<div class="docs-upload-field">
						<label class="docs-upload-label">{{ 'DOCS.UPLOAD.VISIBILITY' | translate }}</label>
						<nb-select fullWidth size="small" [(selected)]="visibility">
							<nb-option [value]="visibilityEnum.ORGANIZATION">{{
								'DOCS.VISIBILITY.ORGANIZATION' | translate
							}}</nb-option>
							<nb-option [value]="visibilityEnum.PRIVATE">{{
								'DOCS.VISIBILITY.PRIVATE' | translate
							}}</nb-option>
						</nb-select>
					</div>
					<div class="docs-upload-field docs-upload-field--wide">
						<label class="docs-upload-label">{{ 'DOCS.UPLOAD.TAGS' | translate }}</label>
						<!-- [label]="false": the label above already names the field; the
						     selector drew a second "Tags" label of its own. -->
						<ga-tags-color-input
							class="docs-upload-tags"
							[multiple]="true"
							[isOrgLevel]="true"
							[label]="false"
							[selectedTags]="tags"
							(selectedTagsEvent)="tags = $event"
						></ga-tags-color-input>
					</div>
				</section>

				<!-- Processing options -->
				<section class="docs-upload-section">
					<div class="docs-upload-options">
						@if (aiEnabled) {
							<div class="docs-upload-option">
								<nb-toggle [(checked)]="classifyWithAi" labelPosition="end">
									{{ 'DOCS.UPLOAD.AI_CLASSIFY_TOGGLE' | translate }}
								</nb-toggle>
								<div class="docs-upload-hint">{{ 'DOCS.UPLOAD.AI_CLASSIFY_HINT' | translate }}</div>
							</div>
						}
						<div class="docs-upload-option">
							<nb-toggle [(checked)]="importToKnowledge" labelPosition="end">
								{{ 'DOCS.UPLOAD.KNOWLEDGE_TOGGLE' | translate }}
							</nb-toggle>
							<div class="docs-upload-hint">{{ 'DOCS.UPLOAD.KNOWLEDGE_HINT' | translate }}</div>
						</div>
					</div>
				</section>
			</nb-card-body>

			<nb-card-footer class="docs-upload-dialog-footer">
				<button nbButton ghost size="small" (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" size="small" [disabled]="!files.length" (click)="confirm()">
					<nb-icon icon="upload-outline"></nb-icon>
					{{ 'DOCS.UPLOAD.START' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-upload-dialog {
				width: 36rem;
				max-width: calc(100vw - 2rem);
				margin: 0;
			}

			/* Header: title left, close right. */
			.docs-upload-dialog-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.875rem 1.25rem;
			}
			.docs-upload-dialog-title {
				font-size: 1rem;
				font-weight: 600;
				line-height: 1.5rem;
			}
			.docs-upload-dialog-close {
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
			}
			.docs-upload-dialog-close nb-icon {
				margin: 0;
			}

			/* Body scrolls between a fixed header and footer. */
			.docs-upload-dialog-body {
				display: flex;
				flex-direction: column;
				gap: 1.25rem;
				max-height: calc(100vh - 11rem);
				padding: 1rem 1.25rem 1.25rem;
				overflow-y: auto;
			}

			.docs-upload-section {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				min-width: 0;
			}
			.docs-upload-label {
				display: block;
				margin: 0;
				font-size: 0.75rem;
				font-weight: 600;
				line-height: 1rem;
				color: var(--text-hint-color);
			}
			.docs-upload-hint {
				margin-top: 0.25rem;
				padding-inline-start: 2.75rem;
				font-size: 0.75rem;
				line-height: 1rem;
				color: var(--text-hint-color);
			}

			/* Files: a bordered list, one row per file. */
			.docs-upload-files {
				max-height: 10rem;
				overflow-y: auto;
				border: 1px solid var(--border-basic-color-4);
				border-radius: 0.375rem;
			}
			.docs-upload-file {
				display: grid;
				grid-template-columns: auto minmax(0, 1fr) auto auto;
				align-items: center;
				gap: 0.5rem;
				min-height: 2.25rem;
				padding: 0.25rem 0.375rem 0.25rem 0.75rem;
				font-size: 0.8125rem;
			}
			.docs-upload-file + .docs-upload-file {
				border-top: 1px solid var(--border-basic-color-4);
			}
			.docs-upload-file-icon {
				font-size: 1rem;
				color: var(--text-hint-color);
			}
			.docs-upload-file-name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-upload-file-size {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				font-variant-numeric: tabular-nums;
			}
			.docs-upload-file-remove {
				width: 1.5rem;
				height: 1.5rem;
				padding: 0;
			}
			.docs-upload-file-remove nb-icon {
				margin: 0;
			}
			.docs-upload-files-empty {
				padding: 0.625rem 0.75rem;
				font-size: 0.8125rem;
				color: var(--text-hint-color);
			}

			/* Categories | Visibility, then Tags across both columns. */
			.docs-upload-grid {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 1rem 0.75rem;
			}
			.docs-upload-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				min-width: 0;
			}
			.docs-upload-field--wide {
				grid-column: 1 / -1;
			}

			/* The shared tag selector draws a light ng-select by default; match the
			   dialog's other inputs. */
			.docs-upload-tags ::ng-deep .ng-select .ng-select-container {
				min-height: 2rem;
				border: 1px solid var(--input-basic-border-color, var(--border-basic-color-4)) !important;
				border-radius: 0.375rem !important;
				background-color: var(--input-basic-background-color, var(--background-basic-color-2)) !important;
				color: var(--input-basic-text-color, var(--text-basic-color));
				box-shadow: none !important;
			}
			.docs-upload-tags ::ng-deep .ng-select .ng-placeholder {
				color: var(--input-basic-placeholder-text-color, var(--text-hint-color));
			}

			/* Options: the processing switches in one bordered group. */
			.docs-upload-options {
				border: 1px solid var(--border-basic-color-4);
				border-radius: 0.375rem;
			}
			.docs-upload-option {
				padding: 0.75rem;
			}
			.docs-upload-option + .docs-upload-option {
				border-top: 1px solid var(--border-basic-color-4);
			}

			.docs-upload-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
				padding: 0.75rem 1.25rem;
			}
			.docs-upload-dialog-footer button nb-icon {
				margin-inline-end: 0.25rem;
			}

			@media (max-width: 575px) {
				.docs-upload-grid {
					grid-template-columns: minmax(0, 1fr);
				}
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.Eager,
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
