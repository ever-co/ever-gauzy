import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ITreeOptions, TreeComponent, TreeModel, TreeNode, TREE_ACTIONS } from '@ali-hm/angular-tree-component';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { filter, firstValueFrom, map, Observable } from 'rxjs';
import { DocumentKindEnum, ID, IDocument, PermissionsEnum } from '@gauzy/contracts';
import { FavoriteStoreService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsActions } from '../../+state/documents.actions';
import { CreateDialogComponent } from '../../dialogs/create-dialog.component';
import { DOCS_PAGE_LINK, DOCS_RECENTS_KEY_PREFIX, DOCS_RECENTS_LIMIT } from '../../docs.constants';
import { DocumentTreeStore, IDocsTreeNode } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';
import {
	buildDocsActionMenu,
	docsActionMenuSignature,
	docsActionOf,
	DocsActionId,
	IDocsActionMenuContext
} from '../actions/docs-action-menu';
import { DocsRowActionsService } from '../actions/docs-row-actions.service';

interface IRecentEntry {
	id: string;
	name: string;
	kind: DocumentKindEnum;
}

const TREE_MENU_TAG_PREFIX = 'gz-docs-tree-node-';

/**
 * Key codes the tree binds through `ITreeOptions.actionMapping.keys`
 * (`01-ux-spec.md` §16/§17).
 *
 * 🛑 Numeric, and deliberately NOT taken from the library's exported `KEYS`
 * table: that table stops at the six navigation keys and, worse, ships
 * `CONTEXT_MENU: 32` — the code for Space, not for the context-menu key. Reusing
 * it would have bound "open the node menu" to the key that activates a node.
 */
const TREE_KEY = {
	/** Rename in place. */
	F2: 113,
	/** Archive (the destructive step the row actions gate behind archive-first). */
	DELETE: 46,
	/** `Shift+F10` — the platform's keyboard context-menu chord. */
	F10: 121,
	/** The dedicated context-menu key found on most PC keyboards. */
	CONTEXT_MENU: 93,
	UP: 38,
	DOWN: 40
} as const;

/**
 * Documents tree sidebar: favorites + recents sections above the lazy folder
 * tree. Drag & drop re-parents through the move API with a client-side cycle
 * check; the per-kind context menu is permission-filtered.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-tree',
	templateUrl: './docs-tree.component.html',
	styleUrls: ['./docs-tree.component.scss'],
	standalone: false
})
export class DocsTreeComponent extends TranslationBaseComponent implements OnInit {
	@ViewChild(TreeComponent) private readonly tree: TreeComponent;

	public nodes: IDocsTreeNode[] = [];
	public recents: IRecentEntry[] = [];
	public favorites$: Observable<{ title: string; link?: string; icon?: unknown }[]>;
	public readonly kindEnum = DocumentKindEnum;

	/** Public: the empty-state create buttons are gated on it in the template. */
	public canCreate = false;
	private canUpdate = false;
	private canDelete = false;
	private canAiImport = false;

	/** nodeId → last built menu, keyed by the signature it was built from. */
	private readonly menuCache = new Map<string, { signature: string; items: NbMenuItem[] }>();

	public options: ITreeOptions = {
		childrenField: 'children',
		idField: 'id',
		useVirtualScroll: true,
		getChildren: (node: { data: IDocsTreeNode }) => this.treeStore.loadChildren(node.data.id),
		allowDrag: (node: { data: IDocsTreeNode }) => this.canUpdate && !node.data.isLocked,
		allowDrop: (element: { data: IDocsTreeNode }, { parent }: { parent: { data?: IDocsTreeNode } }) =>
			this.canUpdate &&
			(!parent?.data || parent.data.kind !== DocumentKindEnum.FILE) && // FILE nodes are leaves
			!this.treeStore.isDescendantOf(parent?.data?.id, element.data.id) && // no cycle: never into own subtree
			element.data.id !== parent?.data?.id,
		/**
		 * Keyboard parity with the node context menu (`01-ux-spec.md` §16/§17).
		 *
		 * 🛑 Every handler listed here replaces the library default for that key, so
		 * `UP`/`DOWN` must forward to `PREVIOUS_NODE`/`NEXT_NODE` when Ctrl is not held
		 * — binding them bare would break plain arrow navigation through the tree.
		 * `performKeyAction` calls `preventDefault()` for any key it finds here, which
		 * is also what stops the page-level shortcut map from seeing these events.
		 */
		actionMapping: {
			keys: {
				[TREE_KEY.F2]: (_tree: TreeModel, node: TreeNode) => void this.runNodeAction('rename', node),
				// Archive, not delete: `DELETE /documents/:id` answers 409
				// `DOCS_DELETE_REQUIRES_ARCHIVE` for anything still live, so the destructive
				// key does the step that can actually succeed.
				[TREE_KEY.DELETE]: (_tree: TreeModel, node: TreeNode) => void this.runNodeAction('archive', node),
				[TREE_KEY.F10]: (_tree: TreeModel, node: TreeNode, event: KeyboardEvent) => {
					if (event?.shiftKey) this.openNodeContextMenu(node);
				},
				[TREE_KEY.CONTEXT_MENU]: (_tree: TreeModel, node: TreeNode) => this.openNodeContextMenu(node),
				[TREE_KEY.UP]: (tree: TreeModel, node: TreeNode, event: KeyboardEvent) => {
					if (!event?.ctrlKey) return void TREE_ACTIONS.PREVIOUS_NODE(tree, node, event);
					void this.reorderNode(node, -1);
				},
				[TREE_KEY.DOWN]: (tree: TreeModel, node: TreeNode, event: KeyboardEvent) => {
					if (!event?.ctrlKey) return void TREE_ACTIONS.NEXT_NODE(tree, node, event);
					void this.reorderNode(node, 1);
				}
			}
		}
	};

	constructor(
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly actions: Actions,
		private readonly treeStore: DocumentTreeStore,
		private readonly documentsService: DocumentsService,
		private readonly rowActions: DocsRowActionsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly nbMenuService: NbMenuService,
		private readonly permissionsService: NgxPermissionsService,
		private readonly favoriteStore: FavoriteStoreService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.permissionsService.permissions$.pipe(untilDestroyed(this)).subscribe((permissions) => {
			this.canCreate = !!permissions[PermissionsEnum.DOCS_CREATE];
			this.canUpdate = !!permissions[PermissionsEnum.DOCS_UPDATE];
			this.canDelete = !!permissions[PermissionsEnum.DOCS_DELETE];
			this.canAiImport = !!permissions[PermissionsEnum.DOCS_AI_IMPORT];
			this.menuCache.clear();
		});

		// Menu labels are baked in at build time, so a language switch (and a star
		// toggled anywhere in the app) has to drop the memo.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.menuCache.clear());
		this.rowActions.favoriteIds$.pipe(untilDestroyed(this)).subscribe(() => this.menuCache.clear());

		this.treeStore.nodes$.pipe(untilDestroyed(this)).subscribe((nodes) => {
			this.nodes = nodes.map((node) => ({ ...node }));
		});
		// Fire-and-forget, but the promise must still be terminated: `loadRoots()` →
		// `loadChildren()` → `firstValueFrom(getAll(...))` carries no internal catch, so a
		// failed roots fetch would escape as an unhandled rejection. An empty sidebar is
		// the same degradation the store already applies to its own reloads
		// (`document-tree.store.ts` `invalidate` / `invalidateAll`).
		void this.treeStore.loadRoots().catch(() => undefined);

		// Starred documents from the shared favorites store, filtered to Documents links.
		this.favorites$ = this.favoriteStore.favoriteItems$.pipe(
			map((items: any[]) => items.filter((item) => String(item?.link ?? '').startsWith(DOCS_PAGE_LINK)))
		);

		this.loadRecents();

		this.nbMenuService
			.onItemClick()
			.pipe(
				filter(({ tag }) => (tag ?? '').startsWith(TREE_MENU_TAG_PREFIX)),
				untilDestroyed(this)
			)
			.subscribe(({ tag, item }) => {
				const nodeId = tag.slice(TREE_MENU_TAG_PREFIX.length);
				// Deliberate fire-and-forget (a menu click cannot be awaited) — `void` is safe
				// only because `onContextAction` now owns its failure path and never rejects.
				void this.onContextAction(docsActionOf(item), nodeId);
			});
	}

	// ─── Selection ───────────────────────────────────────────────

	onNodeActivate(event: { node: { data: IDocsTreeNode } }): void {
		const node = event?.node?.data;
		if (!node) return;
		this.recordRecent(node);
		switch (node.kind) {
			case DocumentKindEnum.FOLDER:
				this.actions.dispatch(DocumentsActions.folderChanged(node.id));
				break;
			case DocumentKindEnum.PAGE:
				this.router.navigate(['page', node.id], { relativeTo: this.route });
				break;
			case DocumentKindEnum.FILE:
				this.actions.dispatch(DocumentsActions.detailOpened(node.id));
				break;
		}
	}

	/** Section title / root crumb — clears the folder scope back to "All documents". */
	goToRoot(): void {
		this.actions.dispatch(DocumentsActions.folderChanged(null));
	}

	// ─── Root-level create (empty tree) ──────────────────────────

	/**
	 * Creates a FOLDER or PAGE at the **root**.
	 *
	 * Deliberately not routed through `DocsRowActionsService.execute('new-folder')`:
	 * that executor creates a child *of a target node*, and the whole point of this
	 * affordance is the state where no node exists. A created page opens straight in
	 * the editor, matching what activating a PAGE node does; a folder stays put and
	 * only refreshes the surfaces that show it.
	 */
	async createAtRoot(kind: DocumentKindEnum): Promise<void> {
		let created: IDocument | null = null;
		try {
			created = await firstValueFrom(
				this.dialogService.open(CreateDialogComponent, { context: { kind, parentId: null } }).onClose
			);
		} catch {
			// The dialog reports its own failures; a dismissed/failed create is a no-op.
			return;
		}
		if (!created) return;
		this.treeStore.invalidate(null);
		this.actions.dispatch(DocumentsActions.loadDocuments());
		if (kind === DocumentKindEnum.PAGE) {
			this.router.navigate(['page', created.id], { relativeTo: this.route });
		}
	}

	/**
	 * Raises the upload flow through the browse page's one-shot `?upload=1` deep
	 * link — the same channel the node context menu's "Upload here" uses, so the
	 * file input, the classification dialog and the queue stay owned by the page
	 * that renders them.
	 *
	 * No `folder` is sent, so the files land in the scope the hub is currently
	 * browsing. That is the root wherever this button is reachable: it only renders
	 * when the tree has no root nodes, i.e. when the organization has no documents
	 * to have drilled into.
	 *
	 * The empty command array keeps the current route: Angular's `createUrlTree`
	 * short-circuits on `commands.length === 0`, so this is a pure query-param merge.
	 */
	uploadHere(): void {
		void this.router.navigate([], {
			queryParams: { upload: 1 },
			queryParamsHandling: 'merge'
		});
	}

	// ─── Drag & drop ─────────────────────────────────────────────

	async onMoveNode(event: { node: IDocsTreeNode; to: { parent?: { id?: ID; virtual?: boolean }; index: number } }): Promise<void> {
		const nodeId = event.node?.id;
		if (!nodeId) return;
		const rawParent = event.to?.parent as { id?: ID; virtual?: boolean } | undefined;
		const parentId: ID | null = rawParent && !rawParent.virtual && rawParent.id ? rawParent.id : null;
		const previousParentId = this.treeStore.getNode(nodeId)?.parentId ?? null;
		// Optimistic local re-parent; revert on API error.
		this.treeStore.applyMove(nodeId, parentId);
		try {
			await firstValueFrom(this.documentsService.move(nodeId, { parentId, index: event.to?.index ?? 0 }));
			this.treeStore.invalidate(previousParentId);
			this.treeStore.invalidate(parentId);
		} catch {
			this.treeStore.applyMove(nodeId, previousParentId);
			this.treeStore.invalidate(previousParentId);
			this.treeStore.invalidate(parentId);
			this.toastrService.danger(this.getTranslation('DOCS.TOASTS.MOVE_FAILED'));
		}
	}

	// ─── Context menu ────────────────────────────────────────────

	menuTag(node: IDocsTreeNode): string {
		return `${TREE_MENU_TAG_PREFIX}${node.id}`;
	}

	/**
	 * Per-kind, permission-filtered menu for one node (`01-ux-spec.md` §3.5),
	 * built by the SAME builder the table and cards kebabs use.
	 *
	 * 🛑 Memoized. The template calls this from a binding, and `[nbContextMenu]`
	 * rebuilds its overlay whenever the bound array is a new reference — an
	 * un-memoized builder would rebuild every open menu on every change-detection
	 * pass. The signature covers everything the item set is derived from, so a
	 * kind/archive/knowledge/favorite/permission change still produces a new array.
	 */
	menuItemsFor(node: IDocsTreeNode): NbMenuItem[] {
		const context = this.menuContext(node);
		const signature = docsActionMenuSignature(node, context);
		const cached = this.menuCache.get(String(node.id));
		if (cached?.signature === signature) return cached.items;
		const items = buildDocsActionMenu(node, context);
		this.menuCache.set(String(node.id), { signature, items });
		return items;
	}

	private menuContext(node?: IDocsTreeNode): IDocsActionMenuContext {
		return {
			surface: 'tree',
			translate: (key: string) => this.getTranslation(key),
			isFavorite: node ? this.rowActions.isFavorite(node.id) : false,
			permissions: {
				create: this.canCreate,
				update: this.canUpdate,
				delete: this.canDelete,
				aiImport: this.canAiImport
			}
		};
	}

	/**
	 * Runs one context-menu action.
	 *
	 * 🛑 **Never rejects.** The only caller is the `nbMenuService.onItemClick()` subscription,
	 * which cannot await it, so an escaping rejection would be an unhandled one.
	 * `DocsRowActionsService.execute()` owns its failure path for every mutation; the
	 * `open` branch below is the only tree-local one and cannot throw.
	 */
	private async onContextAction(action: DocsActionId | undefined, nodeId: string): Promise<void> {
		if (!action) return;
		const node = this.treeStore.getNode(nodeId);
		if (!node) return;
		if (action === 'open') {
			this.onNodeActivate({ node: { data: node } });
			return;
		}
		const changed = await this.rowActions.execute(action, node);
		// A rename/archive/delete changes the label or the membership of the branch
		// the node lives in; the cached menu was built from the pre-mutation node.
		if (changed) this.menuCache.delete(String(nodeId));
	}

	// ─── Keyboard actions (`01-ux-spec.md` §16/§17) ──────────────

	/**
	 * Runs one row action for the focused node through the SAME executor the context
	 * menu uses, so F2/Delete open the same dialogs and raise the same toasts and
	 * invalidations as their menu items.
	 *
	 * 🛑 **Never rejects** — the caller is the tree's synchronous key dispatcher,
	 * which cannot await it. `execute()` owns its own failure path.
	 */
	private async runNodeAction(action: DocsActionId, node: TreeNode): Promise<void> {
		const data = node?.data as IDocsTreeNode | undefined;
		if (!data?.id || !this.canUpdate) return;
		const changed = await this.rowActions.execute(action, data);
		// A rename/archive changed the label or the branch membership the cached menu
		// was built from.
		if (changed) this.menuCache.delete(String(data.id));
	}

	/**
	 * `Ctrl+↑/↓` — reorders the focused node among its siblings.
	 *
	 * Same `POST /:id/move` the drag & drop path uses, with the node's current parent
	 * kept and only `index` shifted. The tree cache is invalidated rather than patched
	 * because sibling order is server-owned (`index ASC`), so the reload is what makes
	 * the new order authoritative instead of guessed.
	 *
	 * 🛑 Never rejects — see {@link runNodeAction}.
	 */
	private async reorderNode(node: TreeNode, delta: number): Promise<void> {
		const data = node?.data as IDocsTreeNode | undefined;
		if (!data?.id || !this.canUpdate || data.isLocked) return;
		const index = (node.index ?? 0) + delta;
		// Nothing above the first sibling. The upper bound is left to the server, which
		// clamps to the sibling count — the client's view of a branch can be stale.
		if (index < 0) return;
		const parentId = data.parentId ?? null;
		try {
			await firstValueFrom(this.documentsService.move(data.id, { parentId, index }));
			this.treeStore.invalidate(parentId);
		} catch {
			this.toastrService.danger(this.getTranslation('DOCS.TOASTS.MOVE_FAILED'));
		}
	}

	/**
	 * `Shift+F10` / the context-menu key — opens the focused node's kebab.
	 *
	 * `[nbContextMenu]` exposes no imperative open handle, so the trigger button is
	 * addressed by the `data-docs-node-menu` attribute the node template stamps with
	 * the node id and clicked: the overlay then anchors exactly as it does on a
	 * pointer click. The button is `visibility: hidden` until hover/focus, which does
	 * not block a synthetic click.
	 */
	private openNodeContextMenu(node: TreeNode): void {
		const id = (node?.data as IDocsTreeNode | undefined)?.id;
		if (!id) return;
		const trigger = document.querySelector<HTMLElement>(`[data-docs-node-menu="${String(id)}"]`);
		trigger?.click();
	}

	// ─── Node rendering helpers ──────────────────────────────────

	kindIcon(node: IDocsTreeNode): string {
		switch (node.kind) {
			case DocumentKindEnum.FOLDER:
				return 'folder-outline';
			case DocumentKindEnum.PAGE:
				return 'file-text-outline';
			default:
				return 'file-outline';
		}
	}

	// ─── Recents (localStorage, per organization) ────────────────

	private recentsKey(): string {
		return `${DOCS_RECENTS_KEY_PREFIX}${this.store.selectedOrganization?.id ?? 'default'}`;
	}

	private loadRecents(): void {
		try {
			this.recents = JSON.parse(localStorage.getItem(this.recentsKey()) ?? '[]');
		} catch {
			this.recents = [];
		}
	}

	private recordRecent(node: IDocsTreeNode): void {
		const entry: IRecentEntry = { id: String(node.id), name: node.name, kind: node.kind };
		this.recents = [entry, ...this.recents.filter((recent) => recent.id !== entry.id)].slice(0, DOCS_RECENTS_LIMIT);
		localStorage.setItem(this.recentsKey(), JSON.stringify(this.recents));
	}

	openFavorite(favorite: { link?: string }): void {
		if (favorite?.link) {
			this.router.navigateByUrl(favorite.link);
		}
	}

	openRecent(entry: IRecentEntry): void {
		this.onNodeActivate({ node: { data: { ...entry, id: entry.id, hasChildren: false } as IDocsTreeNode } });
	}
}
