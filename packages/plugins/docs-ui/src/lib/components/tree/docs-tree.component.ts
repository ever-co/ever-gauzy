import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ITreeOptions, TreeComponent } from '@ali-hm/angular-tree-component';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { filter, firstValueFrom, map, Observable } from 'rxjs';
import { DocumentKindEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { FavoriteStoreService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsActions } from '../../+state/documents.actions';
import { DOCS_PAGE_LINK, DOCS_RECENTS_KEY_PREFIX, DOCS_RECENTS_LIMIT } from '../../docs.constants';
import { CreateDialogComponent } from '../../dialogs/create-dialog.component';
import { MoveDialogComponent } from '../../dialogs/move-dialog.component';
import { DocumentTreeStore, IDocsTreeNode } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';

interface IRecentEntry {
	id: string;
	name: string;
	kind: DocumentKindEnum;
}

const TREE_MENU_TAG_PREFIX = 'gz-docs-tree-node-';

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
	@ViewChild(TreeComponent) private tree: TreeComponent;

	public nodes: IDocsTreeNode[] = [];
	public recents: IRecentEntry[] = [];
	public favorites$: Observable<{ title: string; link?: string; icon?: unknown }[]>;
	public readonly kindEnum = DocumentKindEnum;

	private canCreate = false;
	private canUpdate = false;

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
			element.data.id !== parent?.data?.id
	};

	constructor(
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly actions: Actions,
		private readonly treeStore: DocumentTreeStore,
		private readonly documentsService: DocumentsService,
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
		});

		this.treeStore.nodes$.pipe(untilDestroyed(this)).subscribe((nodes) => {
			this.nodes = nodes.map((node) => ({ ...node }));
		});
		void this.treeStore.loadRoots();

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
				this.onContextAction((item as NbMenuItem & { data?: { action?: string } }).data?.action, nodeId);
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

	menuItemsFor(node: IDocsTreeNode): NbMenuItem[] {
		const items: NbMenuItem[] = [];
		const container = node.kind !== DocumentKindEnum.FILE;
		if (this.canCreate && container) {
			items.push(
				{ title: this.getTranslation('DOCS.TREE.NEW_PAGE'), data: { action: 'new-page' } },
				{ title: this.getTranslation('DOCS.TREE.NEW_FOLDER'), data: { action: 'new-folder' } },
				{ title: this.getTranslation('DOCS.TREE.UPLOAD_HERE'), data: { action: 'upload-here' } }
			);
		}
		if (this.canUpdate) {
			items.push(
				{ title: this.getTranslation('DOCS.TREE.RENAME'), data: { action: 'rename' } },
				{ title: this.getTranslation('DOCS.TREE.MOVE'), data: { action: 'move' } },
				{ title: this.getTranslation('DOCS.TREE.DUPLICATE'), data: { action: 'duplicate' } },
				{ title: this.getTranslation('DOCS.TREE.ARCHIVE'), data: { action: 'archive' } }
			);
		}
		return items;
	}

	private async onContextAction(action: string | undefined, nodeId: string): Promise<void> {
		if (!action) return;
		const node = this.treeStore.getNode(nodeId);
		switch (action) {
			case 'new-page':
				await this.createChild(nodeId, DocumentKindEnum.PAGE);
				break;
			case 'new-folder':
				await this.createChild(nodeId, DocumentKindEnum.FOLDER);
				break;
			case 'upload-here':
				this.router.navigate([], {
					relativeTo: this.route,
					queryParams: { upload: 1, folder: nodeId },
					queryParamsHandling: 'merge'
				});
				break;
			case 'rename':
				await this.rename(nodeId);
				break;
			case 'move':
				await this.openMoveDialog(nodeId);
				break;
			case 'duplicate':
				try {
					await firstValueFrom(this.documentsService.duplicate(nodeId));
					this.treeStore.invalidate(node?.parentId ?? null);
					this.toastrService.success(this.getTranslation('DOCS.TOASTS.DUPLICATED'));
				} catch (error) {
					this.toastrService.danger(error);
				}
				break;
			case 'archive':
				try {
					await firstValueFrom(this.documentsService.archive(nodeId));
					this.treeStore.invalidate(node?.parentId ?? null);
					this.actions.dispatch(DocumentsActions.rowRemoved(nodeId));
					this.toastrService.success(this.getTranslation('DOCS.TOASTS.ARCHIVED'));
				} catch (error) {
					this.toastrService.danger(error);
				}
				break;
		}
	}

	private async createChild(parentId: ID, kind: DocumentKindEnum): Promise<void> {
		const created = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, { context: { kind, parentId } }).onClose
		);
		if (created) {
			this.treeStore.invalidate(parentId);
			this.actions.dispatch(DocumentsActions.loadDocuments());
		}
	}

	private async rename(nodeId: ID): Promise<void> {
		const node = this.treeStore.getNode(nodeId);
		if (!node) return;
		const renamed = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, {
				context: { kind: node.kind, parentId: node.parentId ?? null, renameId: nodeId, initialName: node.name }
			}).onClose
		);
		if (renamed) {
			this.treeStore.invalidate(node.parentId ?? null);
			this.actions.dispatch(DocumentsActions.loadDocuments());
		}
	}

	private async openMoveDialog(nodeId: ID): Promise<void> {
		const node = this.treeStore.getNode(nodeId);
		const moved = await firstValueFrom(
			this.dialogService.open(MoveDialogComponent, { context: { documentIds: [nodeId] } }).onClose
		);
		if (moved) {
			this.treeStore.invalidate(node?.parentId ?? null);
			this.actions.dispatch(DocumentsActions.loadDocuments());
		}
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
