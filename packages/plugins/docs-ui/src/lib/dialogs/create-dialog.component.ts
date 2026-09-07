import { Component, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsService } from '../services/documents.service';

/**
 * Minimal create/rename dialog for FOLDER and PAGE nodes (tree context menu,
 * `?newPage=1` deep link). Closes with the created/updated document or null.
 */
@Component({
	selector: 'gz-docs-create-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>
				{{ (renameId ? 'DOCS.TREE.RENAME' : kind === kindEnum.FOLDER ? 'DOCS.TREE.NEW_FOLDER' : 'DOCS.TREE.NEW_PAGE') | translate }}
			</nb-card-header>
			<nb-card-body>
				<label class="label" for="docs-create-name">{{ 'DOCS.DIALOGS.CREATE_NAME_LABEL' | translate }}</label>
				<input
					id="docs-create-name"
					nbInput
					fullWidth
					type="text"
					[(ngModel)]="name"
					(keyup.enter)="confirm()"
					autofocus
				/>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" [disabled]="!name?.trim() || saving" (click)="confirm()">
					{{ 'DOCS.DIALOGS.CREATE_CONFIRM' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-dialog {
				min-width: 22rem;
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
			.label {
				display: block;
				margin-bottom: 0.25rem;
			}
		`
	],
	standalone: false
})
export class CreateDialogComponent extends TranslationBaseComponent {
	@Input() kind: DocumentKindEnum = DocumentKindEnum.FOLDER;
	@Input() parentId: ID | null = null;
	/** When set, the dialog renames the existing document instead of creating. */
	@Input() renameId: ID | null = null;
	@Input() initialName = '';

	public name = '';
	public saving = false;
	public readonly kindEnum = DocumentKindEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<CreateDialogComponent>,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.name = this.initialName ?? '';
	}

	async confirm(): Promise<void> {
		const name = this.name?.trim();
		if (!name || this.saving) return;
		this.saving = true;
		try {
			let document: IDocument;
			if (this.renameId) {
				document = await firstValueFrom(this.documentsService.update(this.renameId, { name }));
				this.toastrService.success(this.getTranslation('DOCS.TOASTS.RENAMED'));
			} else {
				document = await firstValueFrom(
					this.documentsService.create({ kind: this.kind, name, parentId: this.parentId ?? undefined })
				);
				this.toastrService.success(this.getTranslation('DOCS.TOASTS.CREATED'));
			}
			this.dialogRef.close(document);
		} catch (error) {
			// The raw HttpErrorResponse renders as "Http failure response … 400 OK" —
			// log it for diagnosis, show the user a human sentence.
			console.error('Document create/rename failed', error);
			this.toastrService.danger(
				this.getTranslation(this.renameId ? 'DOCS.ERRORS.RENAME_FAILED' : 'DOCS.ERRORS.CREATE_FAILED')
			);
			this.saving = false;
		}
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
