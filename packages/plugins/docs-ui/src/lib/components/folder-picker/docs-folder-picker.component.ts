import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DocumentKindEnum, ID } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentTreeStore, IDocsTreeNode } from '../../services/document-tree.store';

/** One selectable destination row — `id: null` is the tree root. */
export interface IDocsFolderDestination {
	id: ID | null;
	name: string;
	depth: number;
	disabled: boolean;
}

/**
 * Flattened destination tree with a search box, shared by the Move dialog
 * (`01-ux-spec.md` §10.6) and the upload dialog's Destination field (§7.2) —
 * one picker, one set of rules, so "where does this go?" looks and behaves the
 * same wherever it is asked.
 *
 * Drop rules mirror the tree's `allowDrop`: FILE nodes are leaves, and nothing
 * may target a document being moved or anything inside it (`excludeIds`). The
 * upload dialog passes no `excludeIds` — a new file has no subtree to fall into.
 */
@Component({
	selector: 'gz-docs-folder-picker',
	template: `
		<input
			nbInput
			fullWidth
			size="small"
			type="text"
			[placeholder]="'DOCS.DIALOGS.MOVE_SEARCH' | translate"
			[attr.aria-label]="'DOCS.DIALOGS.MOVE_SEARCH' | translate"
			[(ngModel)]="search"
		/>
		<div class="docs-folder-picker-list">
			<button
				*ngFor="let destination of filtered"
				type="button"
				class="docs-folder-picker-item"
				[class.selected]="isSelected(destination)"
				[disabled]="destination.disabled"
				[style.padding-left.rem]="0.5 + destination.depth * 1"
				(click)="select(destination)"
			>
				<nb-icon [icon]="destination.id ? 'folder-outline' : 'home-outline'" size="tiny"></nb-icon>
				{{ destination.name }}
			</button>
		</div>
	`,
	styles: [
		`
			.docs-folder-picker-list {
				max-height: 40vh;
				overflow-y: auto;
				margin: 0.75rem 0;
				display: flex;
				flex-direction: column;
			}
			.docs-folder-picker-item {
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
			.docs-folder-picker-item:hover:not(:disabled) {
				background: var(--background-basic-color-2);
			}
			.docs-folder-picker-item.selected {
				background: var(--color-primary-transparent-200);
			}
			.docs-folder-picker-item:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}
		`
	],
	standalone: false
})
export class DocsFolderPickerComponent extends TranslationBaseComponent implements OnInit {
	/** Documents that must not be offered as a destination (move source + its subtree). */
	@Input() excludeIds: ID[] = [];
	/** `undefined` = nothing chosen yet; `null` = the root. */
	@Input() selectedId: ID | null | undefined = undefined;

	@Output() selectedIdChange = new EventEmitter<ID | null>();

	public destinations: IDocsFolderDestination[] = [];
	public search = '';

	constructor(public readonly translateService: TranslateService, private readonly treeStore: DocumentTreeStore) {
		super(translateService);
	}

	ngOnInit(): void {
		void this.loadDestinations();
	}

	get filtered(): IDocsFolderDestination[] {
		const query = this.search.trim().toLowerCase();
		if (!query) return this.destinations;
		return this.destinations.filter((destination) => destination.name.toLowerCase().includes(query));
	}

	isSelected(destination: IDocsFolderDestination): boolean {
		return this.selectedId !== undefined && destination.id === this.selectedId;
	}

	select(destination: IDocsFolderDestination): void {
		if (destination.disabled) return;
		this.selectedId = destination.id;
		this.selectedIdChange.emit(destination.id);
	}

	/**
	 * Builds the destination list.
	 *
	 * 🛑 **Never rejects.** `loadRoots()` carries no internal catch, so a failed tree
	 * fetch would be an unhandled rejection *and* leave `destinations` empty — the
	 * picker would then offer nothing selectable at all, not even the root.
	 */
	private async loadDestinations(): Promise<void> {
		const root: IDocsFolderDestination = {
			id: null,
			name: this.getTranslation('DOCS.CARDS.BREADCRUMB_ROOT'),
			depth: 0,
			disabled: false
		};
		try {
			const roots = await this.treeStore.loadRoots();
			this.destinations = [root, ...this.flatten(roots, 1)];
		} catch {
			// The tree is unavailable — the root is still a valid destination.
			this.destinations = [root];
		}
	}

	private flatten(nodes: IDocsTreeNode[], depth: number): IDocsFolderDestination[] {
		const excluded = new Set((this.excludeIds ?? []).map(String));
		const result: IDocsFolderDestination[] = [];
		for (const node of nodes) {
			// Same rules as tree allowDrop: FILE nodes are leaves; never into an excluded subtree.
			if (node.kind === DocumentKindEnum.FILE) continue;
			const inExcludedSubtree = (this.excludeIds ?? []).some((id) => this.treeStore.isDescendantOf(node.id, id));
			result.push({
				id: node.id,
				name: node.name,
				depth,
				disabled: excluded.has(String(node.id)) || inExcludedSubtree
			});
			if (node.children?.length) {
				result.push(...this.flatten(node.children, depth + 1));
			}
		}
		return result;
	}
}
