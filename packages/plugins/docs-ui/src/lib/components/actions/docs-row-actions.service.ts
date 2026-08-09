import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Observable, Subscription } from 'rxjs';
import { DocumentKindEnum, ID, IDocument, BaseEntityEnum, IFavorite } from '@gauzy/contracts';
import { GenericFavoriteService, FavoriteStoreService, Store, ToastrService } from '@gauzy/ui-core/core';
import { DocumentsActions } from '../../+state/documents.actions';
import { DOCS_PAGE_LINK } from '../../docs.constants';
import { CreateDialogComponent } from '../../dialogs/create-dialog.component';
import { DocsDeleteDialogComponent, IDocsDeleteDialogResult } from '../../dialogs/delete-dialog.component';
import { MoveDialogComponent } from '../../dialogs/move-dialog.component';
import { DocsExportService } from '../../services/docs-export.service';
import { DocumentTreeStore } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';
import { DocsActionId, IDocsActionTarget } from './docs-action-menu';

/**
 * Runs one row/context-menu action, wherever it was raised from.
 *
 * The tree, the table kebab and the cards kebab all build their items from
 * `buildDocsActionMenu()` and hand the result here, so a mutation behaves
 * identically on all three: same dialogs, same toasts, same tree-cache
 * invalidation and the same store actions (`rowChanged` / `rowRemoved` /
 * `loadDocuments`) that keep the list, facets and preset counts honest.
 *
 * 🛑 The **view** actions (`open` / `details` / `preview`) are deliberately NOT
 * handled here — those need the caller's route context and per-surface meaning
 * (in the tree, opening a FILE means the detail panel; in the table it means the
 * preview modal). `execute()` returns `false` for them so a surface that forgets
 * to route one does nothing rather than doing the wrong thing.
 */
@Injectable()
export class DocsRowActionsService implements OnDestroy {
	/** Document ids the current user has starred; derived from the shared favorites store. */
	private readonly _favoriteIds$ = new BehaviorSubject<ReadonlySet<string>>(new Set<string>());
	public readonly favoriteIds$: Observable<ReadonlySet<string>> = this._favoriteIds$.asObservable();

	/**
	 * `FavoriteStoreService` is app-root-scoped and outlives this module-scoped
	 * service, so its stream is released explicitly — an unmanaged subscription to
	 * a root singleton keeps the whole plugin chunk alive after a route teardown.
	 */
	private readonly favoritesSubscription: Subscription;

	constructor(
		private readonly translateService: TranslateService,
		private readonly documentsService: DocumentsService,
		private readonly exportService: DocsExportService,
		private readonly treeStore: DocumentTreeStore,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly actions: Actions,
		private readonly router: Router,
		private readonly favoriteStore: FavoriteStoreService,
		private readonly genericFavoriteService: GenericFavoriteService,
		private readonly store: Store
	) {
		// The store already loads (and reloads) favorites per organization; the
		// Documents entries carry `/pages/documents?id=<uuid>` links, so the starred
		// ids come off that stream instead of a second round trip per rendered row.
		this.favoritesSubscription = this.favoriteStore.favoriteItems$.subscribe((items) => {
			const ids = (items ?? [])
				.map((item) => this.documentIdOfLink(item?.link))
				.filter((id): id is string => !!id);
			this._favoriteIds$.next(new Set(ids));
		});
	}

	ngOnDestroy(): void {
		this.favoritesSubscription?.unsubscribe();
	}

	/** Star state for the menu label (`Favorite` vs `Unfavorite`). */
	isFavorite(id: ID): boolean {
		return this._favoriteIds$.value.has(String(id));
	}

	/**
	 * Runs `action` against `target`.
	 *
	 * **Never rejects** — every caller is a menu-click subscription that cannot
	 * await it, so an escaping rejection would be an unhandled one. Returns true
	 * when something actually changed (the caller may refresh its own surface).
	 */
	async execute(action: DocsActionId | undefined, target: IDocsActionTarget): Promise<boolean> {
		if (!action || !target?.id) return false;
		try {
			switch (action) {
				case 'new-page':
					return await this.createChild(target, DocumentKindEnum.PAGE);
				case 'new-folder':
					return await this.createChild(target, DocumentKindEnum.FOLDER);
				case 'upload-here':
					return this.uploadHere(target);
				case 'rename':
					return await this.rename(target);
				case 'move':
					return await this.move(target);
				case 'duplicate':
					return await this.duplicate(target, false);
				case 'duplicate-deep':
					return await this.duplicate(target, true);
				case 'favorite':
					return await this.toggleFavorite(target);
				case 'copy-link':
					return await this.copyLink(target);
				case 'download':
					return await this.download(target);
				case 'export-markdown':
					return await this.exportMarkdown(target);
				case 'knowledge-import':
				case 'knowledge-exclude':
					return await this.setKnowledge(target, action === 'knowledge-import');
				case 'archive':
				case 'restore':
					return await this.setArchived(target, action === 'archive');
				case 'delete':
					return await this.remove(target);
				default:
					// `open` / `details` / `preview` belong to the calling surface.
					return false;
			}
		} catch (error) {
			this.toastrService.danger(error);
			return false;
		}
	}

	// ─── Create / rename / move ──────────────────────────────────

	private async createChild(target: IDocsActionTarget, kind: DocumentKindEnum): Promise<boolean> {
		const created: IDocument | null = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, { context: { kind, parentId: target.id } }).onClose
		);
		if (!created) return false;
		this.treeStore.invalidate(target.id);
		this.actions.dispatch(DocumentsActions.loadDocuments());
		return true;
	}

	/**
	 * Hands the upload flow the destination folder through the browse page's
	 * one-shot `?upload=1&folder=` deep link.
	 *
	 * The empty command array is what keeps the current route: Angular's
	 * `createUrlTree` short-circuits on `commands.length === 0` and reuses the
	 * active URL, so this is a pure query-param merge from any Documents route
	 * (the effects write the hub's URL exactly the same way).
	 */
	private uploadHere(target: IDocsActionTarget): boolean {
		void this.router.navigate([], {
			queryParams: { upload: 1, folder: String(target.id) },
			queryParamsHandling: 'merge'
		});
		return false;
	}

	private async rename(target: IDocsActionTarget): Promise<boolean> {
		const renamed: IDocument | null = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, {
				context: {
					kind: target.kind,
					parentId: target.parentId ?? null,
					renameId: target.id,
					initialName: target.name ?? ''
				}
			}).onClose
		);
		if (!renamed) return false;
		this.treeStore.invalidate(target.parentId ?? null);
		this.actions.dispatch(DocumentsActions.rowChanged(renamed));
		return true;
	}

	private async move(target: IDocsActionTarget): Promise<boolean> {
		const moved = await firstValueFrom(
			this.dialogService.open(MoveDialogComponent, { context: { documentIds: [target.id] } }).onClose
		);
		if (!moved) return false;
		// The dialog already reset the whole tree cache; the list has to re-query
		// because the row may have left the current folder scope entirely.
		this.actions.dispatch(DocumentsActions.loadDocuments());
		return true;
	}

	/**
	 * `POST /:id/duplicate` with `{ deep }` — the deep copy is what the "with
	 * children" item sends. A shallow duplicate of a container keeps the copy
	 * empty, which is why the two are separate items rather than one guess.
	 */
	private async duplicate(target: IDocsActionTarget, deep: boolean): Promise<boolean> {
		await firstValueFrom(this.documentsService.duplicate(target.id, { deep }));
		this.treeStore.invalidate(target.parentId ?? null);
		this.toastrService.success(this.getTranslation('DOCS.TOASTS.DUPLICATED'));
		this.actions.dispatch(DocumentsActions.loadDocuments());
		return true;
	}

	// ─── Read-only affordances ───────────────────────────────────

	private async toggleFavorite(target: IDocsActionTarget): Promise<boolean> {
		const organization = this.store.selectedOrganization;
		if (!organization) return false;
		const employeeId = this.store.user?.employee?.id;
		// `toggleFavorite` needs the favorite ROWS (it deletes by favorite id), which
		// the nav-menu projection does not carry — hence the read right before the write.
		const favorites: IFavorite[] = await this.genericFavoriteService.loadFavorites(
			BaseEntityEnum.Document,
			organization,
			employeeId
		);
		await this.genericFavoriteService.toggleFavorite(
			BaseEntityEnum.Document,
			String(target.id),
			organization,
			employeeId,
			favorites
		);
		return true;
	}

	/** Deep link to the row: a PAGE opens its editor route, anything else the detail panel. */
	deepLink(target: IDocsActionTarget): string {
		const path =
			target.kind === DocumentKindEnum.PAGE
				? `${DOCS_PAGE_LINK}/page/${target.id}`
				: `${DOCS_PAGE_LINK}?id=${target.id}`;
		return `${window.location.origin}${path}`;
	}

	private async copyLink(target: IDocsActionTarget): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(this.deepLink(target));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.LINK_COPIED'));
		} catch {
			// Clipboard permission denied / unavailable — nothing to roll back.
		}
		return false;
	}

	/**
	 * `GET /:id/download` is a JWT-guarded JSON endpoint answering `{ url }`, not a
	 * redirect: the signed provider URL has to be resolved through the
	 * authenticated client first and only then opened.
	 */
	private async download(target: IDocsActionTarget): Promise<boolean> {
		const url = await firstValueFrom(this.documentsService.getDownloadUrl(target.id));
		if (url) window.open(url, '_blank', 'noopener');
		return false;
	}

	private async exportMarkdown(target: IDocsActionTarget): Promise<boolean> {
		// `downloadMarkdown` resolves a PAGE's body from the API itself, so the
		// menu's lightweight target is all it needs.
		const written = await this.exportService.downloadMarkdown({
			id: target.id,
			name: target.name ?? '',
			kind: target.kind
		} as IDocument);
		if (!written) this.toastrService.warning(this.getTranslation('DOCS.EXPORT.NOTHING_TO_EXPORT'));
		return false;
	}

	// ─── Mutations ───────────────────────────────────────────────

	private async setKnowledge(target: IDocsActionTarget, include: boolean): Promise<boolean> {
		const document = include
			? await firstValueFrom(this.documentsService.knowledgeImport(target.id))
			: await firstValueFrom(this.documentsService.knowledgeExclude(target.id));
		this.toastrService.success(
			this.getTranslation(include ? 'DOCS.TOASTS.KNOWLEDGE_IMPORTED' : 'DOCS.TOASTS.KNOWLEDGE_EXCLUDED')
		);
		this.actions.dispatch(DocumentsActions.rowChanged(document));
		this.actions.dispatch(DocumentsActions.refreshFacets());
		return true;
	}

	/**
	 * Archive/unarchive both cascade over the subtree and both move the row across
	 * the `archived` scope, so the list is re-queried rather than patched: which
	 * way the row travels depends on the active preset, and `loadDocuments` also
	 * refreshes the facets and preset counts.
	 */
	private async setArchived(target: IDocsActionTarget, archive: boolean): Promise<boolean> {
		const document = archive
			? await firstValueFrom(this.documentsService.archive(target.id))
			: await firstValueFrom(this.documentsService.unarchive(target.id));
		this.treeStore.invalidate(target.parentId ?? null);
		this.toastrService.success(this.getTranslation(archive ? 'DOCS.TOASTS.ARCHIVED' : 'DOCS.TOASTS.RESTORED'));
		this.actions.dispatch(DocumentsActions.rowChanged(document));
		this.actions.dispatch(DocumentsActions.loadDocuments());
		return true;
	}

	/**
	 * Archived-only delete with the subtree-vs-promote prompt (`01-ux-spec.md`
	 * §10.11). The dialog owns the choice; this only forwards it.
	 */
	private async remove(target: IDocsActionTarget): Promise<boolean> {
		const result: IDocsDeleteDialogResult | null = await firstValueFrom(
			this.dialogService.open(DocsDeleteDialogComponent, { context: { target } }).onClose
		);
		if (!result?.strategy) return false;
		await firstValueFrom(this.documentsService.delete(target.id, { strategy: result.strategy }));
		this.treeStore.invalidate(target.parentId ?? null);
		this.toastrService.success(this.getTranslation('DOCS.TOASTS.DELETED'));
		this.actions.dispatch(DocumentsActions.rowRemoved(target.id));
		this.actions.dispatch(DocumentsActions.refreshFacets());
		return true;
	}

	// ─── Helpers ─────────────────────────────────────────────────

	/** `TranslationBaseComponent.getTranslation` is component-side; the service reads the same store. */
	private getTranslation(key: string, params?: object): string {
		return this.translateService.instant(key, params);
	}

	/** `/pages/documents?id=<uuid>` → `<uuid>`; anything else is not a Documents favorite. */
	private documentIdOfLink(link: unknown): string | null {
		const value = String(link ?? '');
		if (!value.startsWith(DOCS_PAGE_LINK)) return null;
		return value.split('?id=')[1]?.split('&')[0] || null;
	}
}
