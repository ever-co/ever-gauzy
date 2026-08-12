import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbDialogService, NbMenuItem, NbMenuService, NbToastrService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, take, tap } from 'rxjs/operators';
import {
	ComponentLayoutStyleEnum,
	DocumentKindEnum,
	DocumentReviewStatusEnum,
	ID,
	IDocument,
	PermissionsEnum
} from '@gauzy/contracts';
import { ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { IPaginationBase, PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';
import { DocumentsActions } from '../../+state/documents.actions';
import { DocumentsQuery } from '../../+state/documents.query';
import { DocumentsStore } from '../../+state/documents.store';
import {
	DOCS_CARDS_PAGE_SIZE,
	DOCS_DEFAULT_PAGE_SIZE,
	DOCS_PREVIEW_DIALOG_CONFIG,
	DOCS_REVIEW_TOAST_DURATION_MS,
	DOCS_SEARCH_DEBOUNCE_MS,
	DOCS_UPLOAD_ACCEPT
} from '../../docs.constants';
import { IDocsCardsCrumb } from '../../components/cards/docs-cards.component';
import { DocsPreviewModalComponent } from '../../components/preview/docs-preview-modal.component';
import { DocsStatsLineComponent } from '../../components/stats/docs-stats-line.component';
import {
	ClassificationDialogComponent,
	IDocsUploadDialogResult
} from '../../dialogs/classification-dialog.component';
import { CreateDialogComponent } from '../../dialogs/create-dialog.component';
import {
	createInitialDocsFilterState,
	DocsFilterState,
	hasActiveFilters,
	parseDocsFilterFromParams
} from '../../models/docs-filter.model';
import { DocsEmptyVariant } from '../../components/empty/empty-state.component';
import { humanizeBytes } from '../../models/docs-format.util';
import { DocumentTreeStore } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';
import { UploadQueueService } from '../../services/upload-queue.service';
import { toDocsBreadcrumb } from './docs-breadcrumb.util';
import { DOCS_BROWSE_OVERLAY_SELECTOR, DOCS_SEARCH_INPUT_ID, docsBrowseShortcutOf } from './docs-browse-shortcuts';
import { DOCS_PERMISSIONS } from '../../docs-permission-groups';

/**
 * Browse page orchestrator: owns URL restore, the table ↔ cards view toggle
 * (persisted via `ComponentEnum.DOCUMENTS_HUB`, `?view=` overrides for one load),
 * the location breadcrumb + "Load more" paging, the create menu (`New ▾`), the
 * preview modal, the upload flow (`?upload=1` / `?newPage=1` / `?newFolder=1`
 * one-shot deep links), selection, the keyboard shortcut map and the processing
 * poll wiring.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-browse-page',
	templateUrl: './docs-browse-page.component.html',
	styleUrls: ['./docs-browse-page.component.scss'],
	standalone: false
})
export class DocsBrowsePageComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	/**
	 * Stable permission arrays for the template's `*ngxPermissionsOnly` gates.
	 * 🛑 Never inline `[permissions.X]` in a binding — a fresh array each change-detection cycle
	 * makes ngx-permissions re-validate forever and wedges the main thread.
	 */
	public readonly docsPermissions = DOCS_PERMISSIONS;

	@ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;
	/** `New ▾` trigger — the `n` shortcut opens the menu by clicking it. */
	@ViewChild('newMenuTrigger', { read: ElementRef }) newMenuTrigger: ElementRef<HTMLElement>;
	/** Stats tiles — re-pulled when uploads/bulk actions change the counts. */
	@ViewChild('statsLine') statsLine?: DocsStatsLineComponent;

	public readonly query = this.documentsQuery;
	public readonly uploadAccept = DOCS_UPLOAD_ACCEPT;
	public readonly permissions = PermissionsEnum;
	public readonly layoutStyles = ComponentLayoutStyleEnum;
	public dataLayoutStyle: ComponentLayoutStyleEnum = ComponentLayoutStyleEnum.TABLE;
	public dropActive = false;
	public canManage = false;
	/** `DOCS_CREATE` — gates the `u` (upload) and `n` (New ▾) shortcuts. */
	public canCreate = false;
	/** Ancestor chain of the current tree location, rendered in the page header. */
	public breadcrumb: IDocsCardsCrumb[] = [];
	/** Live query params, handed to the saved-views control (UX spec §5). */
	public urlParams: Params = {};
	/** Nebular menu tag of the `New ▾` split menu. */
	public readonly newMenuTag = 'docs-browse-new';
	/** `New ▾` items — Folder, then Page (`01-ux-spec.md` §2). Rebuilt on language change. */
	public newMenu: NbMenuItem[] = [];

	private readonly search$ = new Subject<string>();
	private pendingUploadFolder: ID | null = null;
	/** The layout store emits its current value immediately — the first emission is not a switch. */
	private viewInitialized = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly actions: Actions,
		private readonly documentsStore: DocumentsStore,
		private readonly documentsQuery: DocumentsQuery,
		private readonly documentsService: DocumentsService,
		private readonly documentTreeStore: DocumentTreeStore,
		public readonly uploadQueue: UploadQueueService,
		private readonly dialogService: NbDialogService,
		private readonly nbMenuService: NbMenuService,
		private readonly toastrService: ToastrService,
		// Only the review handoff toast needs the raw Nebular service — see
		// `notifyIfNeedsReview()`; everything else goes through `toastrService`.
		private readonly nbToastrService: NbToastrService,
		private readonly store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		// 1) Restore state from the URL (single source of truth for shareable state).
		this.restoreFromUrl();

		// 2) Search input debounces 500 ms before it becomes a filter change.
		this.search$
			.pipe(debounceTime(DOCS_SEARCH_DEBOUNCE_MS), distinctUntilChanged(), untilDestroyed(this))
			.subscribe((q) => this.actions.dispatch(DocumentsActions.filterChanged({ q })));

		// 3) Pagination component → store.
		this.pagination$
			.pipe(distinctUntilChange(), untilDestroyed(this))
			.subscribe(({ activePage, itemsPerPage }: IPaginationBase) => {
				const current = this.documentsQuery.pagination;
				if (current.page !== activePage || current.pageSize !== itemsPerPage) {
					this.actions.dispatch(
						DocumentsActions.paginationChanged({ page: activePage, pageSize: itemsPerPage })
					);
				}
			});

		// 4) Keep the pagination component in sync with the total count.
		this.documentsQuery.totalCount$.pipe(untilDestroyed(this)).subscribe((totalCount) => {
			this.setPagination({ ...this.getPagination(), totalItems: totalCount });
		});

		// 5) Org switches reload everything.
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap(() => this.actions.dispatch(DocumentsActions.loadDocuments())),
				untilDestroyed(this)
			)
			.subscribe();

		// 6) Cards breadcrumb follows the tree location.
		this.documentsQuery.folderId$
			.pipe(
				distinctUntilChanged(),
				tap((folderId) => void this.refreshBreadcrumb(folderId)),
				untilDestroyed(this)
			)
			.subscribe();

		// 7) Mirror the live query string for the saved-views control, and consume the
		//    one-shot action deep links off the SAME stream.
		//
		//    🛑 Not the initial snapshot: `DocsRowActionsService.uploadHere()` and the tree's
		//    empty-state buttons merge `?upload=1` / `?newPage=1` / `?newFolder=1` into the URL
		//    while this page is already mounted, and a snapshot-only read (which is what
		//    `restoreFromUrl()` did) never saw them — so "Upload here" did nothing whenever the
		//    hub was the current route, which is every time it is raised from the sidebar.
		this.route.queryParams.pipe(untilDestroyed(this)).subscribe((params) => {
			this.urlParams = params ?? {};
			this.consumeOneShotParams(this.urlParams);
		});

		// 8) Server-side upload rejections get a readable toast. The per-file row
		//    already shows the failure; the toast exists because a quota rejection
		//    is not retryable and the user must go free space or raise the quota.
		this.uploadQueue.rejections$.pipe(untilDestroyed(this)).subscribe((rejection) => {
			switch (rejection.reason) {
				case 'quota-exceeded':
					this.toastrService.danger(
						rejection.message || this.getTranslation('DOCS.ERRORS.QUOTA_EXCEEDED'),
						this.getTranslation('DOCS.ERRORS.QUOTA_EXCEEDED')
					);
					break;
				case 'too-large':
					this.toastrService.warning(
						this.getTranslation('DOCS.UPLOAD.FILE_TOO_LARGE', {
							name: rejection.file.name,
							max: humanizeBytes(this.uploadQueue.maxFileSizeBytes)
						})
					);
					break;
				case 'type-not-allowed':
					this.toastrService.warning(
						this.getTranslation('DOCS.UPLOAD.TYPE_NOT_ALLOWED', { name: rejection.file.name })
					);
					break;
				default:
					// Generic failures are already visible on the queue row with a
					// Retry button — a toast per file would be pure noise.
					break;
			}
		});

		// 8b) A single upload that finishes READY but PENDING review gets an actionable
		//     toast straight to the review queue (§7.3). Every settled upload also
		//     moves the stats tiles.
		this.uploadQueue.documentReady$.pipe(untilDestroyed(this)).subscribe((document) => {
			this.notifyIfNeedsReview(document);
			this.statsLine?.reload();
		});

		this.canManage = this.store.hasPermission(PermissionsEnum.DOCS_MANAGE);
		this.canCreate = this.store.hasPermission(PermissionsEnum.DOCS_CREATE);

		// 9) Header menus: build them, keep them translated, and act on their clicks.
		this.buildHeaderMenus();
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.buildHeaderMenus());
		this.nbMenuService
			.onItemClick()
			.pipe(
				filter(({ tag }) => tag === this.newMenuTag),
				untilDestroyed(this)
			)
			.subscribe(({ item }) => {
				const action = (item as NbMenuItem & { data?: { action?: string } }).data?.action;
				// A menu click cannot be awaited; every branch owns its own failure path.
				switch (action) {
					case 'new-folder':
						void this.openNewFolderDialog();
						break;
					case 'new-page':
						void this.openNewPageDialog();
						break;
				}
			});
	}

	ngOnDestroy(): void {
		// UntilDestroy handles subscriptions.
	}

	// ─── Keyboard shortcuts (`01-ux-spec.md` §16/§17) ────────────

	/**
	 * Document-level shortcut map: `/` search, `u` upload, `n` New ▾, `v` layout
	 * toggle, `Esc` clear selection → close the detail panel.
	 *
	 * Bound on `document` rather than the host because the surface the shortcuts act
	 * on spans three sibling components (the sidebar tree, this page and the detail
	 * panel) and the user is rarely focused inside this component's subtree.
	 * {@link docsBrowseShortcutOf} owns every "keep your hands off this key" rule;
	 * the open-overlay probe below is the one guard it cannot make, because a
	 * context menu does not move focus and so never shows up on `event.target`.
	 */
	@HostListener('document:keydown', ['$event'])
	onDocumentKeydown(event: KeyboardEvent): void {
		const shortcut = docsBrowseShortcutOf(event);
		if (!shortcut) return;
		if (document.querySelector(DOCS_BROWSE_OVERLAY_SELECTOR)) return;

		switch (shortcut) {
			case 'search':
				this.focusSearch();
				break;
			case 'upload':
				if (!this.canCreate) return;
				this.openUploadFlow();
				break;
			case 'new':
				if (!this.canCreate) return;
				// `[nbContextMenu]` has no imperative open handle — clicking the trigger is
				// the directive's own entry point, so the menu opens anchored exactly as it
				// does on a pointer click.
				this.newMenuTrigger?.nativeElement?.click();
				break;
			case 'toggle-view':
				this.setLayout(
					this.isCardsView ? ComponentLayoutStyleEnum.TABLE : ComponentLayoutStyleEnum.CARDS_GRID
				);
				break;
			case 'dismiss':
				// Selection first: `Esc` on a multi-select is "never mind", and closing the
				// panel out from under a pending bulk action would be the wrong undo.
				if (this.documentsQuery.selectedIds.length) {
					this.onClearSelection();
				} else if (this.documentsQuery.detailId) {
					this.actions.dispatch(DocumentsActions.detailClosed());
				} else {
					return;
				}
				break;
		}
		event.preventDefault();
	}

	/** `/` — the filter bar owns the input; the page only moves focus into it. */
	private focusSearch(): void {
		const input = document.getElementById(DOCS_SEARCH_INPUT_ID) as HTMLInputElement | null;
		input?.focus();
		input?.select?.();
	}

	// ─── View toggle (ComponentEnum.DOCUMENTS_HUB) ───────────────

	setView(): void {
		this.viewComponentName = ComponentEnum.DOCUMENTS_HUB;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout: ComponentLayoutStyleEnum) => {
					this.dataLayoutStyle = componentLayout ?? ComponentLayoutStyleEnum.TABLE;
					this.actions.dispatch(
						DocumentsActions.viewChanged(
							this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID ? 'cards' : 'table'
						)
					);
					// The first emission is the restored preference — `restoreFromUrl()`
					// issues that load. Only a real switch re-queries.
					if (this.viewInitialized) {
						this.actions.dispatch(DocumentsActions.loadDocuments());
					}
					this.viewInitialized = true;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public viewComponentName: ComponentEnum;

	/** Header toggle click — persists through the standard layout mechanism. */
	setLayout(style: ComponentLayoutStyleEnum): void {
		if (this.dataLayoutStyle === style) return;
		this.store.setLayoutForComponent(this.viewComponentName, style);
	}

	get isCardsView(): boolean {
		return this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID;
	}

	// ─── Cards view ──────────────────────────────────────────────

	/**
	 * Search results and every non-All preset are flat (`01-ux-spec.md` §4.2):
	 * the backend drops the `parentId` scope for a search, so folder cards would
	 * misrepresent the result set.
	 */
	isFlat(filter: DocsFilterState | null): boolean {
		return !!(filter?.q || filter?.preset);
	}

	onLoadMore(): void {
		this.actions.dispatch(DocumentsActions.loadMore());
	}

	onDrillIn(folderId: ID | null): void {
		this.actions.dispatch(DocumentsActions.folderChanged(folderId));
	}

	/**
	 * Breadcrumb segment click. A redacted ancestor carries no id — the template
	 * already disables it, and this second guard keeps a stray dispatch from
	 * scoping the list to `null` (i.e. silently jumping to the root).
	 */
	onCrumbClick(crumb: IDocsCardsCrumb): void {
		if (!crumb || crumb.restricted || !crumb.id) return;
		this.onDrillIn(crumb.id);
	}

	openPreview(document: IDocument): void {
		this.dialogService.open(DocsPreviewModalComponent, { ...DOCS_PREVIEW_DIALOG_CONFIG, context: { document } });
	}

	openEditor(document: IDocument): void {
		this.router.navigate(['page', document.id], { relativeTo: this.route });
	}

	/**
	 * Resolves the breadcrumb for the current tree location.
	 *
	 * Preferred source is `GET /documents/:id/path`: it is the only one that can say
	 * an ancestor exists but is *unreadable* (`08-permissions-security.md` §3.2) —
	 * a client-side walk simply loses that folder and silently shortens the path.
	 * Falls back to the shared node cache and then to the document plus its `parent`
	 * relation, so a deployment without the route (or a transient failure) still
	 * renders a usable trail. Unresolvable ancestors are not invented — the root
	 * crumb always gets back out.
	 */
	private async refreshBreadcrumb(folderId: ID | null): Promise<void> {
		if (!folderId) {
			this.breadcrumb = [];
			return;
		}
		const serverPath = await this.resolveServerBreadcrumb(folderId);
		if (serverPath) {
			this.breadcrumb = serverPath;
			return;
		}
		const path = this.documentTreeStore.pathOf(folderId);
		if (path.length) {
			this.breadcrumb = path.map((node) => ({ id: node.id, name: node.name }));
			return;
		}
		try {
			const document = await firstValueFrom(this.documentsService.getById(folderId, ['parent']));
			// The `?.` below used to sit next to a bare `document.id`/`document.name`: the
			// guard admitted a nullish response and the very next line dereferenced it, so an
			// empty body threw a TypeError that only the catch made look intentional.
			if (!document) {
				this.breadcrumb = [];
				return;
			}
			const parent = document.parent;
			this.breadcrumb = [
				...(parent ? [{ id: parent.id as ID, name: parent.name }] : []),
				{ id: document.id as ID, name: document.name }
			];
		} catch {
			this.breadcrumb = [];
		}
	}

	/**
	 * Server-resolved crumbs, or `null` when the route could not answer.
	 *
	 * `null` (not `[]`) is the "fall back" signal — an empty array is a legitimate
	 * answer for a root-level folder and must not send the caller down the local
	 * path, which would produce a different (shorter) trail.
	 *
	 * Deliberately tolerant of both plausible server contracts: the response is
	 * expected to end at the folder itself, and when it carries ancestors only, the
	 * current folder is appended from the node cache so the trail still shows where
	 * the user is standing.
	 */
	private async resolveServerBreadcrumb(folderId: ID): Promise<IDocsCardsCrumb[] | null> {
		try {
			const segments = await firstValueFrom(this.documentsService.getPath(folderId));
			return toDocsBreadcrumb(segments, folderId, (id) => this.documentTreeStore.getNode(id)?.name);
		} catch {
			// 404 on a deployment that predates the route, or a transient failure —
			// either way the local chain is a better answer than no breadcrumb.
			return null;
		}
	}

	// ─── URL restore ─────────────────────────────────────────────

	private restoreFromUrl(): void {
		// The one-shot action params are consumed off the live `queryParams` stream
		// (ngOnInit step 7), which replays the current snapshot on subscribe — so the
		// cold-load case is still covered, and a param merged in later works too.
		this.applyStateFromParams(this.route.snapshot.queryParams);
	}

	/**
	 * One-shot action deep links (`?upload=1` / `?newPage=1` / `?newFolder=1`):
	 * consume, strip with a `replaceUrl` write, then run the action.
	 *
	 * The strip is what makes this safe to run on every emission — the follow-up
	 * emission carries the nulled params and matches nothing. Actions are deferred a
	 * tick so the dialog opens after the current navigation has settled.
	 */
	private consumeOneShotParams(params: Params): void {
		if (params['upload'] === '1') {
			// `?upload=1&folder=` uploads into the folder the LINK named, which is not
			// necessarily the one the list is scoped to — the tree's "Upload here" raises
			// this for an arbitrary node without moving the list.
			const folder = typeof params['folder'] === 'string' && params['folder'] ? (params['folder'] as ID) : null;
			this.pendingUploadFolder = folder ?? this.documentsQuery.folderId;
			this.stripOneShotParams();
			setTimeout(() => this.openUploadFlow());
		} else if (params['newPage'] === '1') {
			this.stripOneShotParams();
			setTimeout(() => void this.openNewPageDialog());
		} else if (params['newFolder'] === '1') {
			this.stripOneShotParams();
			setTimeout(() => void this.openNewFolderDialog());
		}
	}

	/**
	 * Rebuilds the whole browse state from a query-param set and reloads.
	 * Shared by the cold-load restore and by applying a saved view — both are
	 * "the URL changed wholesale, re-derive everything from it" (§5.1).
	 */
	private applyStateFromParams(params: Params): void {
		const filterState: DocsFilterState = parseDocsFilterFromParams(params);
		const folderId = typeof params['folder'] === 'string' && params['folder'] ? params['folder'] : null;
		const page = Math.max(1, parseInt(params['page'], 10) || 1);

		// `?view=` wins over the persisted layout for this load only; with no
		// param the layout subscription's value (already applied) stands.
		const urlView = this.parseViewParam(params['view']);
		const view = urlView ?? this.documentsQuery.view;
		if (urlView) {
			// Render the requested view without writing it to the persisted layout.
			this.dataLayoutStyle =
				urlView === 'cards' ? ComponentLayoutStyleEnum.CARDS_GRID : ComponentLayoutStyleEnum.TABLE;
		}
		const defaultPageSize = view === 'cards' ? DOCS_CARDS_PAGE_SIZE : DOCS_DEFAULT_PAGE_SIZE;
		const pageSize = Math.max(1, parseInt(params['pageSize'], 10) || defaultPageSize);

		this.documentsStore.update({
			filter: filterState,
			folderId,
			pagination: { page, pageSize },
			view,
			selectedIds: []
		});
		// Seed the pagination base with the restored values. `pagination$` is a
		// BehaviorSubject holding the class defaults (page 1 / 10 rows): without
		// this write its very next emission — the replay to the subscription set up
		// right after this call — would dispatch those defaults straight back over
		// the deep link, so `?page=` / `?pageSize=` never survived and the cards
		// view always asked for 10 rows instead of 24.
		this.setPagination({ ...this.getPagination(), activePage: page, itemsPerPage: pageSize });
		this.actions.dispatch(DocumentsActions.loadDocuments());
	}

	/** `?view=` carries only the two canonical layout ids; anything else means "no override". */
	private parseViewParam(value: unknown): 'cards' | 'table' | null {
		if (value === 'cards') return 'cards';
		if (value === 'table') return 'table';
		return null;
	}

	/**
	 * Applies a saved filter view: merge-write its params (the patch already
	 * nulls every view-owned param it does not carry, so nothing leaks from the
	 * previous view), then re-derive state from the resulting URL.
	 */
	async onApplySavedView(patch: Params): Promise<void> {
		await this.router.navigate([], {
			relativeTo: this.route,
			queryParams: patch,
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
		this.applyStateFromParams(this.route.snapshot.queryParams);
	}

	private stripOneShotParams(): void {
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { upload: null, newPage: null, newFolder: null },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	// ─── Filter bar events ───────────────────────────────────────

	onFilterChange(partial: Partial<DocsFilterState>): void {
		this.actions.dispatch(DocumentsActions.filterChanged(partial));
	}

	onSearchChange(q: string): void {
		this.search$.next(q ?? '');
	}

	onPresetToggled(preset: DocsFilterState['preset']): void {
		this.actions.dispatch(DocumentsActions.presetToggled(preset));
	}

	onClearAll(): void {
		this.actions.dispatch(DocumentsActions.filterChanged(createInitialDocsFilterState()));
	}

	onSortChanged(sort: { field: string; order: 'ASC' | 'DESC' }): void {
		this.actions.dispatch(DocumentsActions.filterChanged({ sort }));
	}

	// ─── Table events ────────────────────────────────────────────

	onRowClicked(document: IDocument): void {
		this.actions.dispatch(DocumentsActions.detailOpened(document.id as ID));
	}

	onFolderOpened(document: IDocument): void {
		this.actions.dispatch(DocumentsActions.folderChanged(document.id as ID));
	}

	onSelectionChanged(ids: ID[]): void {
		this.actions.dispatch(DocumentsActions.selectionChanged(ids));
	}

	async onRetryRequested(document: IDocument): Promise<void> {
		try {
			const updated = await firstValueFrom(this.documentsService.reprocess(document.id as ID));
			this.actions.dispatch(DocumentsActions.rowChanged(updated));
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	onBulkCompleted(event: { destructive: boolean }): void {
		this.actions.dispatch(DocumentsActions.bulkCompleted({ destructive: event.destructive }));
		// Archive/delete/review bulk actions move the tile counts.
		this.statsLine?.reload();
	}

	onClearSelection(): void {
		this.actions.dispatch(DocumentsActions.selectionChanged([]));
	}

	// ─── Upload flow ─────────────────────────────────────────────

	openUploadFlow(): void {
		this.fileInput?.nativeElement?.click();
	}

	onDropActiveChange(active: boolean): void {
		this.dropActive = active;
	}

	async onFilesPicked(fileList: FileList | File[] | null): Promise<void> {
		const files = Array.from(fileList ?? []);
		if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
		if (!files.length) return;
		if (files.length > this.uploadQueue.maxFilesPerUpload) {
			this.toastrService.warning(
				this.getTranslation('DOCS.UPLOAD.TOO_MANY_FILES', { max: this.uploadQueue.maxFilesPerUpload })
			);
			return;
		}
		// Upload & classify dialog (§7.2). It owns the batch from here: the user can
		// drop individual files in it, so the *dialog's* list is what gets enqueued —
		// never the originally picked one.
		const result: IDocsUploadDialogResult | null = await firstValueFrom(
			this.dialogService.open(ClassificationDialogComponent, {
				context: { files, parentId: this.pendingUploadFolder ?? this.documentsQuery.folderId }
			}).onClose
		);
		this.pendingUploadFolder = null;
		if (!result?.files?.length) return;
		this.uploadQueue.enqueue(result.files, result.options);
		this.toastrService.info(this.getTranslation('DOCS.TOASTS.UPLOAD_STARTED'), '');
	}

	/**
	 * Single-file upload that lands READY but PENDING review (`01-ux-spec.md` §7.3).
	 *
	 * The toast IS the action — clicking it opens the review queue — which is why it
	 * goes through `NbToastrService` directly: the shared `ToastrService` wrapper
	 * returns void and drops the `NbToastRef` this needs. Restricted to single-file
	 * batches so a ten-file drop cannot raise ten toasts.
	 */
	private notifyIfNeedsReview(document: IDocument): void {
		if (document?.reviewStatus !== DocumentReviewStatusEnum.PENDING) return;
		if (!this.uploadQueue.isSingleFileUpload(document.id as ID)) return;
		const toastRef = this.nbToastrService.warning(
			this.getTranslation('DOCS.TOASTS.UPLOADED_NEEDS_REVIEW'),
			this.getTranslation('DOCS.TOASTS.UPLOADED_NEEDS_REVIEW_ACTION'),
			{ duration: DOCS_REVIEW_TOAST_DURATION_MS, destroyByClick: true }
		);
		toastRef
			.onClick()
			.pipe(take(1), untilDestroyed(this))
			.subscribe(() => this.goToReviewQueue());
	}

	async openNewPageDialog(): Promise<void> {
		const folderId = this.documentsQuery.folderId;
		const created = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, {
				context: { kind: DocumentKindEnum.PAGE, parentId: folderId }
			}).onClose
		);
		if (!created) return;
		// The sidebar branch the page landed in still holds its pre-create memo; the
		// tree outlives this navigation (it lives in the shell), so it has to be told.
		this.documentTreeStore.invalidate(folderId);
		this.router.navigate(['page', created.id], { relativeTo: this.route });
	}

	/**
	 * New folder at the current tree location (`00-product-spec.md` §5.2 E-2).
	 *
	 * Unlike a page, a folder is created **in place**: there is nothing to open, so
	 * the list re-queries and the sidebar branch drops its memo instead of
	 * navigating. Before this existed the only folder-create affordance was a node's
	 * context menu — which needs a node — so a brand-new organization, whose tree is
	 * empty by definition, could never create its first folder.
	 */
	async openNewFolderDialog(): Promise<void> {
		const folderId = this.documentsQuery.folderId;
		const created = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, {
				context: { kind: DocumentKindEnum.FOLDER, parentId: folderId }
			}).onClose
		);
		if (!created) return;
		this.documentTreeStore.invalidate(folderId);
		this.actions.dispatch(DocumentsActions.loadDocuments());
	}

	goToReviewQueue(): void {
		this.router.navigate(['review'], { relativeTo: this.route });
	}

	// ─── Header menus ────────────────────────────────────────────

	/**
	 * `New ▾`. Kept in a method (rather than a getter bound in the template) so
	 * the labels re-translate on a language switch without handing
	 * `[nbContextMenu]` a new array reference on every change-detection pass.
	 */
	private buildHeaderMenus(): void {
		this.newMenu = [
			{
				title: this.getTranslation('DOCS.TREE.NEW_FOLDER'),
				icon: 'folder-add-outline',
				data: { action: 'new-folder' }
			},
			{
				title: this.getTranslation('DOCS.TREE.NEW_PAGE'),
				icon: 'file-add-outline',
				data: { action: 'new-page' }
			}
		];
	}

	// ─── Empty state ─────────────────────────────────────────────

	emptyVariant(rows: IDocument[], error: boolean): DocsEmptyVariant {
		if (error) return 'error';
		if (hasActiveFilters(this.documentsQuery.filter)) return 'no-results';
		if (this.documentsQuery.folderId) return 'empty-folder';
		return 'first-run';
	}

	onEmptyAction(action: string): void {
		switch (action) {
			case 'upload':
				this.openUploadFlow();
				break;
			case 'new-page':
				void this.openNewPageDialog();
				break;
			case 'new-folder':
				void this.openNewFolderDialog();
				break;
			case 'clear-filters':
				this.onClearAll();
				break;
			case 'retry':
				this.actions.dispatch(DocumentsActions.loadDocuments());
				break;
		}
	}
}
