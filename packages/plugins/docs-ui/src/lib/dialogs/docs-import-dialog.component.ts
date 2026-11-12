import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	DocumentImportLayoutEnum,
	DocumentImportStatusEnum,
	DocumentSpaceKindEnum,
	DocumentVisibilityEnum,
	ID,
	IDocumentImport,
	IDocumentImportReportItem,
	IDocumentSpace
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { errorKeyOf, formatLimit, importProgressPercent, importReportGroups, isZipFile, phaseKeyOf, reasonKeyOf } from '../models/docs-import.model';
import { DocsImportRun, DocsImportStep } from '../models/docs-import-run';
import { DocumentsService } from '../services/documents.service';
import { spaceKeyOf, visibilityOfSpace } from './move-space.util';

/** What the dialog closes with: the import (when one started) and the page to open, if the user picked one. */
export interface IDocsImportDialogResult {
	import: IDocumentImport | null;
	openPageId?: ID;
}

/** The items not imported that the report lists; the others are counted under it. */
const NOT_IMPORTED_ROWS = 100;

/** The key of the target "under the current page or folder". */
const PARENT_TARGET = 'parent';

/**
 * Import dialog (`docs-import-export` spec FR-17): pick a zip (a Markdown vault or an HTML export zip), choose where
 * it lands (under the current folder or page, or at the top of a space), start, follow the progress, then read the
 * report — the imported pages to open, and what was skipped or failed, with the reason.
 *
 * Shown only where the import probe answered (`DocsImportService.probeImport`); the server checks everything again.
 * The run (`DocsImportRun`) is the opener's: a dialog closed while an import runs shows its progress, or its report,
 * when it opens again.
 */
@Component({
	selector: 'gz-docs-import-dialog',
	template: `
		<nb-card class="docs-dialog docs-import-dialog" [attr.aria-busy]="step === 'uploading' || step === 'running'">
			<nb-card-header>{{ 'DOCS.IMPORT.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@switch (step) {
					@case ('pick') {
						<p class="hint">{{ 'DOCS.IMPORT.INTRO' | translate: { limit: limitLabel } }}</p>
						<input #fileInput type="file" accept=".zip,application/zip" class="file-input" (change)="onFile($event)" />
						<div class="file-row">
							<button nbButton size="small" appearance="outline" (click)="fileInput.click()">
								<nb-icon icon="archive-outline"></nb-icon>{{ 'DOCS.IMPORT.CHOOSE_FILE' | translate }}
							</button>
							<span class="file-name">{{ file?.name || ('DOCS.IMPORT.NO_FILE' | translate) }}</span>
						</div>
						@if (fileError || run.requestError) {
							<div class="error" role="alert">{{ fileError || run.requestError | translate: { limit: limitLabel } }}</div>
						}
						<div class="target-label">{{ 'DOCS.IMPORT.TARGET' | translate }}</div>
						<nb-radio-group [(value)]="targetKey" name="gz-docs-import-target">
							@if (parentId) {
								<nb-radio [value]="parentTarget">{{ 'DOCS.IMPORT.UNDER' | translate: { name: parentName || '…' } }}</nb-radio>
							}
							@for (space of spaces; track key(space)) {
								<nb-radio [value]="key(space)">{{ spaceLabel(space) }}</nb-radio>
							}
						</nb-radio-group>
					}
					@case ('uploading') {
						<div class="phase">{{ 'DOCS.IMPORT.UPLOADING' | translate }}</div>
						<nb-progress-bar [value]="uploadPercent" status="primary" [displayValue]="true"></nb-progress-bar>
					}
					@case ('running') {
						<div class="phase">{{ phaseKey | translate }}</div>
						<nb-progress-bar [value]="progress" status="primary" [displayValue]="true"></nb-progress-bar>
						<div class="hint">
							{{ 'DOCS.IMPORT.PROGRESS' | translate: { done: current?.processedItems ?? 0, total: current?.totalItems ?? 0 } }}
						</div>
						@if (run.trackingError) {
							<div class="error tracking" role="alert">
								<span>{{ 'DOCS.IMPORT.TRACKING_ERROR' | translate }}</span>
								<button nbButton size="tiny" appearance="outline" (click)="run.retryRead()">{{ 'DOCS.IMPORT.RETRY' | translate }}</button>
							</div>
						}
						<div class="hint">{{ 'DOCS.IMPORT.BACKGROUND_HINT' | translate }}</div>
					}
					@case ('done') {
						@if (current?.status === statuses.FAILED) {
							<div class="error" role="alert">{{ errorKey | translate }}</div>
						} @else {
							<div class="summary" role="status">
								{{ 'DOCS.IMPORT.SUMMARY' | translate: { imported: current?.importedCount ?? 0, skipped: current?.skippedCount ?? 0, failed: current?.failedCount ?? 0 } }}
							</div>
							@if (layoutKey) {
								<div class="hint">{{ layoutKey | translate }}</div>
							}
							@if (groups.unresolvedLinks) {
								<div class="hint">{{ 'DOCS.IMPORT.UNRESOLVED' | translate: { count: groups.unresolvedLinks } }}</div>
							}
							@if (groups.pages.length) {
								<div class="section-title">{{ 'DOCS.IMPORT.PAGES' | translate }}</div>
								<ul class="items">
									@for (item of groups.pages.slice(0, 50); track item.path) {
										<li>
											<a href="#" (click)="openPage($event, item)">{{ item.name || item.path }}</a>
											@if (item.reason) {
												<span class="reason">{{ reasonKey(item.reason) | translate }}</span>
											}
										</li>
									}
								</ul>
								@if (groups.pages.length > 50) {
									<div class="hint">{{ 'DOCS.IMPORT.MORE' | translate: { count: groups.pages.length - 50 } }}</div>
								}
							}
							@if (groups.skipped.length || groups.failed.length) {
								<div class="section-title">{{ 'DOCS.IMPORT.NOT_IMPORTED' | translate }}</div>
								<ul class="items">
									@for (item of notImported.slice(0, notImportedRows); track item.path) {
										<li>
											<span class="path">{{ item.path }}</span>
											<span class="reason">{{ reasonKey(item.reason) | translate }}</span>
										</li>
									}
								</ul>
								@if (notImported.length > notImportedRows) {
									<div class="hint">{{ 'DOCS.IMPORT.MORE' | translate: { count: notImported.length - notImportedRows } }}</div>
								}
							}
							@if (current?.report?.truncated) {
								<div class="hint">{{ 'DOCS.IMPORT.TRUNCATED' | translate }}</div>
							}
						}
					}
				}
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="close()">
					{{ (step === 'pick' ? 'DOCS.UPLOAD.CANCEL' : 'DOCS.IMPORT.CLOSE') | translate }}
				</button>
				@if (step === 'pick') {
					<button nbButton status="primary" [disabled]="!file || !!fileError || !targetKey" (click)="startImport()">
						{{ 'DOCS.IMPORT.START' | translate }}
					</button>
				}
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-import-dialog {
				min-width: 26rem;
				max-width: 36rem;
			}
			.file-input {
				display: none;
			}
			.file-row {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				margin: 0.5rem 0 1rem;
			}
			.file-name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.target-label,
			.section-title {
				font-weight: 600;
				margin: 0.75rem 0 0.25rem;
			}
			nb-radio-group {
				display: flex;
				flex-direction: column;
			}
			.hint {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				margin-top: 0.25rem;
			}
			.phase,
			.summary {
				margin-bottom: 0.5rem;
			}
			.error {
				color: var(--text-danger-color);
				margin: 0.25rem 0;
			}
			.error.tracking {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
			}
			.items {
				max-height: 14rem;
				overflow: auto;
				padding-left: 1.25rem;
				margin: 0;
			}
			.items li {
				display: flex;
				gap: 0.5rem;
				justify-content: space-between;
			}
			.path {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.reason {
				flex: none;
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
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class DocsImportDialogComponent extends TranslationBaseComponent implements OnInit {
	/** The folder or page the user is in (the default target), if any. */
	@Input() parentId?: ID | null;
	@Input() parentName?: string | null;
	/** The largest zip the server takes (from the probe). */
	@Input() maxZipBytes = 0;
	/** The import run, which the opener owns: it outlives the dialog. */
	@Input() run!: DocsImportRun;

	public readonly parentTarget = PARENT_TARGET;
	public readonly statuses = DocumentImportStatusEnum;
	public readonly notImportedRows = NOT_IMPORTED_ROWS;
	public file: File | null = null;
	/** The dialog's own check of the chosen file (type, size); a refusal of the server is the run's `requestError`. */
	public fileError: string | null = null;
	public spaces: IDocumentSpace[] = [];
	public targetKey = '';
	public groups = importReportGroups(null);
	public notImported: IDocumentImportReportItem[] = [];

	private readonly destroyRef = inject(DestroyRef);
	private readonly dialogRef = inject<NbDialogRef<DocsImportDialogComponent>>(NbDialogRef);
	private readonly documentsService = inject(DocumentsService);
	private readonly cdr = inject(ChangeDetectorRef);

	constructor() {
		super(inject(TranslateService));
	}

	ngOnInit(): void {
		this.targetKey = this.parentId ? PARENT_TARGET : '';
		this.refresh();
		this.run.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
		this.documentsService
			.getSpaces()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (spaces) => this.setSpaces(spaces ?? []),
				// Spaces are part of the collaboration feature: without it there are the organization and the private space.
				error: () =>
					this.setSpaces([
						{ kind: DocumentSpaceKindEnum.ORGANIZATION } as IDocumentSpace,
						{ kind: DocumentSpaceKindEnum.PRIVATE } as IDocumentSpace
					])
			});
	}

	get step(): DocsImportStep {
		return this.run.step;
	}

	get uploadPercent(): number {
		return this.run.uploadPercent;
	}

	get current(): IDocumentImport | null {
		return this.run.current;
	}

	get limitLabel(): string {
		return this.maxZipBytes ? formatLimit(this.maxZipBytes) : '';
	}

	get progress(): number {
		return importProgressPercent(this.current);
	}

	get phaseKey(): string {
		return phaseKeyOf(this.current?.phase);
	}

	get errorKey(): string {
		return errorKeyOf(this.current?.errorCode);
	}

	get layoutKey(): string | null {
		switch (this.current?.layout) {
			case DocumentImportLayoutEnum.MARKDOWN_VAULT:
				return 'DOCS.IMPORT.LAYOUT.MARKDOWN_VAULT';
			case DocumentImportLayoutEnum.HTML_EXPORT:
				return 'DOCS.IMPORT.LAYOUT.HTML_EXPORT';
			default:
				return null;
		}
	}

	key(space: IDocumentSpace): string {
		return spaceKeyOf(space);
	}

	reasonKey(reason: string | null | undefined): string {
		return reasonKeyOf(reason);
	}

	spaceLabel(space: IDocumentSpace): string {
		switch (space.kind) {
			case DocumentSpaceKindEnum.ORGANIZATION:
				return this.getTranslation('DOCS.SPACE.ORGANIZATION');
			case DocumentSpaceKindEnum.PRIVATE:
				return this.getTranslation('DOCS.SPACE.PRIVATE');
			default:
				return space.name || this.getTranslation('DOCS.SPACE.TEAM');
		}
	}

	onFile(event: Event): void {
		const input = event.target as HTMLInputElement;
		this.file = input.files?.[0] ?? null;
		this.fileError = null;
		// The server's refusal was of the previous file.
		this.run.clearRequestError();
		if (this.file && !isZipFile(this.file)) this.fileError = 'DOCS.IMPORT.ERROR.NOT_A_ZIP';
		else if (this.file && this.maxZipBytes && this.file.size > this.maxZipBytes) this.fileError = 'DOCS.IMPORT.ERROR.TOO_LARGE';
		this.cdr.markForCheck();
	}

	startImport(): void {
		if (!this.file || this.fileError || !this.targetKey) return;
		const space = this.spaces.find((candidate) => spaceKeyOf(candidate) === this.targetKey);
		const target =
			this.targetKey === PARENT_TARGET
				? { parentId: this.parentId ?? null }
				: {
						visibility: space ? visibilityOfSpace(space.kind) : DocumentVisibilityEnum.ORGANIZATION,
						organizationTeamId: space?.kind === DocumentSpaceKindEnum.TEAM ? (space.organizationTeamId ?? null) : null
					};
		// The run uploads and follows the import, the dialog open or not.
		this.run.start(this.file, target);
	}

	openPage(event: Event, item: IDocumentImportReportItem): void {
		event.preventDefault();
		this.dialogRef.close({ import: this.current, openPageId: item.documentId } as IDocsImportDialogResult);
	}

	close(): void {
		this.dialogRef.close({ import: this.current } as IDocsImportDialogResult);
	}

	/** The report of the run's import, for the view. */
	private refresh(): void {
		this.groups = importReportGroups(this.run.current);
		this.notImported = [...this.groups.failed, ...this.groups.skipped];
		this.cdr.markForCheck();
	}

	private setSpaces(spaces: IDocumentSpace[]): void {
		this.spaces = spaces;
		if (!this.targetKey && spaces.length) {
			const organization = spaces.find((space) => space.kind === DocumentSpaceKindEnum.ORGANIZATION) ?? spaces[0];
			this.targetKey = spaceKeyOf(organization);
		}
		this.cdr.markForCheck();
	}
}
