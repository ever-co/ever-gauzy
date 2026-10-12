import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsService } from '../services/documents.service';

/**
 * FILE extraction correction: plain textarea over `extractedText`. Saving sets
 * `extractedTextEdited` server-side and re-chunks/re-indexes. Offered only for
 * settled (READY/FAILED) FILE documents.
 */
@Component({
	selector: 'gz-docs-extracted-text-dialog',
	template: `
		<nb-card class="docs-dialog docs-extracted-dialog">
			<nb-card-header>{{ 'DOCS.DETAIL.EXTRACTED_DIALOG_TITLE' | translate }}</nb-card-header>
			<nb-card-body [nbSpinner]="loading" nbSpinnerStatus="primary">
				<div class="hint">{{ 'DOCS.DETAIL.EXTRACTED_DIALOG_HINT' | translate }}</div>
				<textarea nbInput fullWidth rows="18" [(ngModel)]="text" [disabled]="loading"></textarea>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" [disabled]="loading || saving" (click)="save()">
					{{ 'DOCS.DETAIL.EXTRACTED_SAVE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-extracted-dialog {
				min-width: 40rem;
				max-width: 60rem;
			}
			.hint {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				margin-bottom: 0.5rem;
			}
			textarea {
				font-family: var(--font-family-monospace, monospace);
				font-size: 0.8125rem;
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
export class ExtractedTextDialogComponent extends TranslationBaseComponent implements OnInit {
	@Input() documentId: ID;

	public text = '';
	public loading = true;
	public saving = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<ExtractedTextDialogComponent>,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	async ngOnInit(): Promise<void> {
		try {
			const result = await firstValueFrom(this.documentsService.getExtractedText(this.documentId));
			this.text = result?.extractedText ?? '';
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.loading = false;
		}
	}

	async save(): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		try {
			const document = await firstValueFrom(
				this.documentsService.updateExtractedText(this.documentId, this.text)
			);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.UPDATED'));
			this.dialogRef.close(document);
		} catch (error) {
			this.toastrService.danger(error);
			this.saving = false;
		}
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
