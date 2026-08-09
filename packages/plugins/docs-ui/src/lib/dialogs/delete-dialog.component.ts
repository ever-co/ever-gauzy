import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { DocumentKindEnum, ID } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsService } from '../services/documents.service';

/** What the dialog needs to know about the node being deleted. */
export interface IDocsDeleteTarget {
	id: ID;
	name?: string;
	kind: DocumentKindEnum;
	/** Known child count, when the caller already has the list projection. */
	childrenCount?: number;
}

/** Closed with this on confirm; `null`/`undefined` on cancel or dismiss. */
export interface IDocsDeleteDialogResult {
	strategy: 'subtree' | 'promote-children';
}

/**
 * Delete prompt for an archived document (`01-ux-spec.md` §10.11).
 *
 * When the node has children the user chooses between deleting the whole
 * subtree and promoting the children one level up; with no children there is
 * nothing to choose and the dialog is a plain confirmation.
 *
 * 🛑 The chosen value leaves as `strategy` — that is the name
 * `DeleteDocumentQueryDTO` declares, and the route validates with
 * `whitelist: true`, so any other param name is stripped and the backend
 * silently falls back to `subtree`. A prompt whose answer is dropped on the
 * wire is worse than no prompt at all.
 */
@Component({
	selector: 'gz-docs-delete-dialog',
	template: `
		<nb-card class="docs-dialog docs-delete-dialog">
			<nb-card-header>{{ 'DOCS.DIALOGS.DELETE_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="docs-delete-body">
					{{ 'DOCS.DIALOGS.DELETE_BODY' | translate : { name: target?.name || '' } }}
				</p>
				<!-- The radios exist only when there is actually a subtree to decide about. -->
				<nb-radio-group *ngIf="hasChildren" [(ngModel)]="strategy" name="docs-delete-strategy">
					<nb-radio value="subtree">{{ 'DOCS.DIALOGS.DELETE_SUBTREE_OPTION' | translate }}</nb-radio>
					<nb-radio value="promote-children">
						{{ 'DOCS.DIALOGS.DELETE_PROMOTE_OPTION' | translate }}
					</nb-radio>
				</nb-radio-group>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="danger" [disabled]="resolving" (click)="confirm()">
					{{ 'DOCS.TREE.DELETE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-delete-dialog {
				min-width: 22rem;
				max-width: 30rem;
			}
			.docs-delete-body {
				margin: 0 0 0.75rem;
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
export class DocsDeleteDialogComponent extends TranslationBaseComponent implements OnInit {
	@Input() target: IDocsDeleteTarget | null = null;

	/** Defaults to the backend's own default, so confirming without touching the radios is a no-surprise. */
	public strategy: 'subtree' | 'promote-children' = 'subtree';
	public hasChildren = false;
	/** True while the child count is still being resolved — Delete waits for it. */
	public resolving = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<DocsDeleteDialogComponent>,
		private readonly documentsService: DocumentsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		void this.resolveChildren();
	}

	/**
	 * Decides whether the strategy choice is offered.
	 *
	 * A caller holding the list projection already knows (`childrenCount`); the
	 * detail panel reads the single-document endpoint, which carries no such
	 * column, so the count is fetched. A FILE is a leaf by construction and never
	 * costs a request. A failed count degrades to "no children" — the backend
	 * default (`subtree`) is then what runs, which is exactly what happened
	 * before this dialog existed.
	 */
	private async resolveChildren(): Promise<void> {
		const target = this.target;
		if (!target || target.kind === DocumentKindEnum.FILE) return;
		if (target.childrenCount !== undefined) {
			this.hasChildren = target.childrenCount > 0;
			return;
		}
		this.resolving = true;
		try {
			const result = await firstValueFrom(
				this.documentsService
					.getAll({ parentId: target.id, archived: 'include', take: 1 })
					.pipe(catchError(() => of({ items: [], total: 0 })))
			);
			this.hasChildren = (result?.total ?? 0) > 0;
		} finally {
			this.resolving = false;
		}
	}

	confirm(): void {
		if (this.resolving) return;
		// With no children there is nothing to promote — never send a strategy the
		// user was not offered.
		this.dialogRef.close({ strategy: this.hasChildren ? this.strategy : 'subtree' } as IDocsDeleteDialogResult);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
