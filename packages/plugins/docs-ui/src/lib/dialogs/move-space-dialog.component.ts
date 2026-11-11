import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DocumentSpaceKindEnum, ID, IDocument, IDocumentSpace } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentTreeStore } from '../services/document-tree.store';
import { DocumentsService } from '../services/documents.service';
import { spaceKeyOf, spaceOfDocument, visibilityOfSpace } from './move-space.util';

/**
 * Move-to-space dialog (`docs-collaboration` FR-3): the spaces the caller sees, the page's own marked, and whether the
 * pages under it go along (the descendants the caller may write; on by default). `POST /documents/:id/space`; only the
 * owner (or `DOCS_MANAGE`) may move a page between spaces, which the server decides. Closes with the moved page.
 */
@Component({
	selector: 'gz-docs-move-space-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>{{ 'DOCS.SPACE.MOVE_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@if (spaces.length) {
					<nb-radio-group [(value)]="selectedKey" name="gz-docs-space">
						@for (space of spaces; track key(space)) {
							<nb-radio [value]="key(space)" [disabled]="key(space) === currentKey">
								{{ label(space) }}
							</nb-radio>
						}
					</nb-radio-group>
					<nb-checkbox [(checked)]="applyToSubtree">{{ 'DOCS.SPACE.MOVE_SUBTREE' | translate }}</nb-checkbox>
				} @else {
					<div class="hint">{{ 'DOCS.SPACE.NONE' | translate }}</div>
				}
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost [disabled]="saving" (click)="cancel()">
					{{ 'DOCS.UPLOAD.CANCEL' | translate }}
				</button>
				<button
					nbButton
					status="primary"
					[disabled]="!selectedKey || selectedKey === currentKey || saving"
					(click)="confirm()"
				>
					{{ 'DOCS.SPACE.MOVE_CONFIRM' | translate }}
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
			nb-radio-group {
				display: flex;
				flex-direction: column;
				margin-bottom: 0.75rem;
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
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class MoveSpaceDialogComponent extends TranslationBaseComponent implements OnInit {
	/** The page to move. */
	@Input() document!: IDocument;

	public spaces: IDocumentSpace[] = [];
	public currentKey = '';
	public selectedKey = '';
	public applyToSubtree = true;
	public saving = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<MoveSpaceDialogComponent>,
		private readonly documentsService: DocumentsService,
		private readonly treeStore: DocumentTreeStore,
		private readonly toastrService: ToastrService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.currentKey = spaceKeyOf(spaceOfDocument(this.document));
		this.documentsService.getSpaces().subscribe({
			next: (spaces) => {
				this.spaces = spaces ?? [];
				this.cdr.markForCheck();
			},
			error: () => {
				this.spaces = [];
				this.cdr.markForCheck();
			}
		});
	}

	key(space: IDocumentSpace): string {
		return spaceKeyOf(space);
	}

	label(space: IDocumentSpace): string {
		switch (space.kind) {
			case DocumentSpaceKindEnum.ORGANIZATION:
				return this.getTranslation('DOCS.SPACE.ORGANIZATION');
			case DocumentSpaceKindEnum.PRIVATE:
				return this.getTranslation('DOCS.SPACE.PRIVATE');
			default:
				return space.name || this.getTranslation('DOCS.SPACE.TEAM');
		}
	}

	async confirm(): Promise<void> {
		const space = this.spaces.find((candidate) => spaceKeyOf(candidate) === this.selectedKey);
		if (!space || this.saving || !this.document?.id) return;
		this.saving = true;
		try {
			const moved = await firstValueFrom(
				this.documentsService.moveToSpace(
					this.document.id as ID,
					{
						visibility: visibilityOfSpace(space.kind),
						organizationTeamId:
							space.kind === DocumentSpaceKindEnum.TEAM ? (space.organizationTeamId ?? null) : null,
						applyToSubtree: this.applyToSubtree
					} as never
				)
			);
			this.toastrService.success(this.getTranslation('DOCS.SPACE.MOVED'));
			this.treeStore.invalidateAll();
			this.dialogRef.close(moved);
		} catch {
			this.toastrService.danger(this.getTranslation('DOCS.SPACE.MOVE_FAILED'));
			this.saving = false;
			this.cdr.markForCheck();
		}
	}

	cancel(): void {
		// A move under way finishes first: closing now would leave the page unaware of a move that lands.
		if (this.saving) return;
		this.dialogRef.close(null);
	}
}
