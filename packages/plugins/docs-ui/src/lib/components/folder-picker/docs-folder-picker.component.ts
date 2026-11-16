import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
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
	/** Drives the row icon — a page can hold children, but should not look like a folder. */
	kind?: DocumentKindEnum;
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
		<!-- Search and list in one bordered box, so the picker reads as a single control. -->
		<div class="docs-folder-picker">
			<div class="docs-folder-picker-search">
				<nb-icon icon="search-outline"></nb-icon>
				<input
					type="text"
					[placeholder]="'DOCS.DIALOGS.MOVE_SEARCH' | translate"
					[attr.aria-label]="'DOCS.DIALOGS.MOVE_SEARCH' | translate"
					[(ngModel)]="search"
				/>
			</div>
			<div class="docs-folder-picker-list">
				@for (destination of filtered; track destination) {
					<button
						type="button"
						class="docs-folder-picker-item"
						[class.selected]="isSelected(destination)"
						[attr.aria-pressed]="isSelected(destination)"
						[disabled]="destination.disabled"
						[style.padding-left.rem]="0.75 + destination.depth * 1"
						(click)="select(destination)"
					>
						<nb-icon class="docs-folder-picker-icon" [icon]="iconFor(destination)"></nb-icon>
						<span class="docs-folder-picker-name">{{ destination.name }}</span>
						@if (isSelected(destination)) {
							<nb-icon class="docs-folder-picker-check" icon="checkmark-outline"></nb-icon>
						}
					</button>
				}
			</div>
		</div>
	`,
	styles: [
		`
			.docs-folder-picker {
				border: 1px solid var(--border-basic-color-4);
				border-radius: 0.375rem;
				overflow: hidden;
			}
			.docs-folder-picker-search {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0 0.75rem;
				border-bottom: 1px solid var(--border-basic-color-4);
				background: var(--input-basic-background-color, var(--background-basic-color-2));
			}
			.docs-folder-picker-search nb-icon {
				flex: 0 0 auto;
				font-size: 1rem;
				color: var(--text-hint-color);
			}
			/* !important: the app-wide input rules otherwise draw a second bordered
			   box inside this row, which is already the field's frame. */
			.docs-folder-picker-search input {
				flex: 1 1 auto;
				min-width: 0;
				height: 2.25rem !important;
				margin: 0 !important;
				padding: 0 !important;
				border: 0 !important;
				border-radius: 0 !important;
				outline: none !important;
				box-shadow: none !important;
				background: transparent !important;
				color: var(--text-basic-color);
				font: inherit;
				font-size: 0.8125rem;
			}
			.docs-folder-picker-search input::placeholder {
				color: var(--text-hint-color);
			}
			.docs-folder-picker-search:focus-within {
				box-shadow: inset 0 -1px 0 0 var(--color-primary-default);
			}
			.docs-folder-picker-list {
				max-height: 14rem;
				overflow-y: auto;
				padding: 0.25rem;
				display: flex;
				flex-direction: column;
			}
			.docs-folder-picker-item {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				min-height: 2rem;
				padding: 0 0.75rem;
				border: none;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--text-basic-color);
				font: inherit;
				font-size: 0.8125rem;
				text-align: left;
				cursor: pointer;
			}
			.docs-folder-picker-item:hover:not(:disabled) {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
			}
			.docs-folder-picker-item:focus-visible {
				outline: 2px solid var(--color-primary-default);
				outline-offset: -2px;
			}
			.docs-folder-picker-item.selected {
				background: var(--gauzy-active-tint, rgba(126, 126, 143, 0.2));
				font-weight: 500;
			}
			.docs-folder-picker-item:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}
			.docs-folder-picker-icon {
				flex: 0 0 auto;
				font-size: 1rem;
				color: var(--text-hint-color);
			}
			.docs-folder-picker-name {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.docs-folder-picker-check {
				flex: 0 0 auto;
				font-size: 1rem;
				color: var(--color-primary-default);
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.Eager,
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

	constructor(
		public readonly translateService: TranslateService,
		private readonly treeStore: DocumentTreeStore
	) {
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

	iconFor(destination: IDocsFolderDestination): string {
		if (!destination.id) return 'home-outline';
		return destination.kind === DocumentKindEnum.PAGE ? 'file-text-outline' : 'folder-outline';
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
				disabled: excluded.has(String(node.id)) || inExcludedSubtree,
				kind: node.kind
			});
			if (node.children?.length) {
				result.push(...this.flatten(node.children, depth + 1));
			}
		}
		return result;
	}
}
