import { Component, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentTreeStore } from '../services/document-tree.store';
import { DocumentsService } from '../services/documents.service';

/**
 * Move dialog: the shared `gz-docs-folder-picker` (flattened destination tree,
 * FILE nodes and each document's own subtree disabled) plus the move call.
 * Used by row action, tree context menu and bulk move. Closes truthy when at
 * least one move succeeded.
 */
@Component({
	selector: 'gz-docs-move-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>{{ 'DOCS.DIALOGS.MOVE_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<gz-docs-folder-picker
					[excludeIds]="documentIds"
					[selectedId]="selectedId"
					(selectedIdChange)="onDestinationChange($event)"
				></gz-docs-folder-picker>
				<div class="hint">{{ 'DOCS.DIALOGS.MOVE_CYCLE_HINT' | translate }}</div>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" [disabled]="selectedId === undefined || saving" (click)="confirm()">
					{{ 'DOCS.DIALOGS.MOVE_CONFIRM' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-dialog {
				min-width: 24rem;
				max-width: 30rem;
			}
			.hint {
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
export class MoveDialogComponent extends TranslationBaseComponent {
	/** Documents being moved (single row action or bulk selection). */
	@Input() documentIds: ID[] = [];

	/** `undefined` until the user picks — `null` is the root and is a valid choice. */
	public selectedId: ID | null | undefined = undefined;
	public saving = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<MoveDialogComponent>,
		private readonly treeStore: DocumentTreeStore,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	onDestinationChange(destinationId: ID | null): void {
		this.selectedId = destinationId;
	}

	async confirm(): Promise<void> {
		if (this.selectedId === undefined || this.saving) return;
		this.saving = true;
		let succeeded = 0;
		for (const id of this.documentIds) {
			try {
				await firstValueFrom(this.documentsService.move(id, { parentId: this.selectedId, index: 0 }));
				succeeded++;
			} catch (error) {
				this.toastrService.danger(this.getTranslation('DOCS.TOASTS.MOVE_FAILED'));
			}
		}
		if (succeeded > 0) {
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.MOVED'));
			this.treeStore.invalidateAll();
			this.dialogRef.close(true);
		} else {
			this.saving = false;
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
