import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DocumentKindEnum, ID } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentTreeStore, IDocsTreeNode } from '../services/document-tree.store';
import { DocumentsService } from '../services/documents.service';

interface IMoveDestination {
	id: ID | null;
	name: string;
	depth: number;
	disabled: boolean;
}

/**
 * Move dialog: flattened destination tree (lazy-expanded to loaded depth) with
 * the same drop rules as the tree — FILE nodes and each document's own subtree
 * are disabled. Used by row action, tree context menu and bulk move. Closes
 * truthy when at least one move succeeded.
 */
@Component({
	selector: 'gz-docs-move-dialog',
	template: `
		<nb-card class="docs-dialog">
			<nb-card-header>{{ 'DOCS.DIALOGS.MOVE_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<input
					nbInput
					fullWidth
					size="small"
					type="text"
					[placeholder]="'DOCS.DIALOGS.MOVE_SEARCH' | translate"
					[(ngModel)]="search"
				/>
				<div class="docs-move-list">
					<button
						*ngFor="let destination of filtered"
						class="docs-move-item"
						[class.selected]="isSelected(destination)"
						[disabled]="destination.disabled"
						[style.padding-left.rem]="0.5 + destination.depth * 1"
						(click)="select(destination)"
					>
						<nb-icon [icon]="destination.id ? 'folder-outline' : 'home-outline'" size="tiny"></nb-icon>
						{{ destination.name }}
					</button>
				</div>
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
			.docs-move-list {
				max-height: 40vh;
				overflow-y: auto;
				margin: 0.75rem 0;
				display: flex;
				flex-direction: column;
			}
			.docs-move-item {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				background: transparent;
				border: none;
				text-align: left;
				padding: 0.375rem 0.5rem;
				cursor: pointer;
				color: var(--text-basic-color);
				border-radius: 0.25rem;
			}
			.docs-move-item:hover:not(:disabled) {
				background: var(--background-basic-color-2);
			}
			.docs-move-item.selected {
				background: var(--color-primary-transparent-200);
			}
			.docs-move-item:disabled {
				opacity: 0.4;
				cursor: not-allowed;
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
export class MoveDialogComponent extends TranslationBaseComponent implements OnInit {
	/** Documents being moved (single row action or bulk selection). */
	@Input() documentIds: ID[] = [];

	public destinations: IMoveDestination[] = [];
	public search = '';
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

	ngOnInit(): void {
		void this.loadDestinations();
	}

	/**
	 * Builds the destination list.
	 *
	 * 🛑 **Never rejects.** This used to be an `async ngOnInit`, whose promise Angular simply
	 * discards: `loadRoots()` carries no internal catch, so a failed tree fetch was an
	 * unhandled rejection *and* left `destinations` empty — the dialog then offered nothing
	 * selectable at all, not even the root.
	 */
	private async loadDestinations(): Promise<void> {
		const root: IMoveDestination = {
			id: null,
			name: this.getTranslation('DOCS.CARDS.BREADCRUMB_ROOT'),
			depth: 0,
			disabled: false
		};
		try {
			const roots = await this.treeStore.loadRoots();
			this.destinations = [root, ...this.flatten(roots, 1)];
		} catch {
			// The tree is unavailable — moving to the root is still a valid destination.
			this.destinations = [root];
		}
	}

	get filtered(): IMoveDestination[] {
		const query = this.search.trim().toLowerCase();
		if (!query) return this.destinations;
		return this.destinations.filter((destination) => destination.name.toLowerCase().includes(query));
	}

	isSelected(destination: IMoveDestination): boolean {
		return this.selectedId !== undefined && destination.id === this.selectedId;
	}

	select(destination: IMoveDestination): void {
		if (!destination.disabled) this.selectedId = destination.id;
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

	private flatten(nodes: IDocsTreeNode[], depth: number): IMoveDestination[] {
		const moving = new Set(this.documentIds.map(String));
		const result: IMoveDestination[] = [];
		for (const node of nodes) {
			const isFile = node.kind === DocumentKindEnum.FILE;
			const isMovingNode = moving.has(String(node.id));
			// Same rules as tree allowDrop: FILE nodes are leaves; never into a moving doc's own subtree.
			const inMovedSubtree = this.documentIds.some((id) => this.treeStore.isDescendantOf(node.id, id));
			if (isFile) continue;
			result.push({
				id: node.id,
				name: node.name,
				depth,
				disabled: isMovingNode || inMovedSubtree
			});
			if (node.children?.length) {
				result.push(...this.flatten(node.children, depth + 1));
			}
		}
		return result;
	}
}
