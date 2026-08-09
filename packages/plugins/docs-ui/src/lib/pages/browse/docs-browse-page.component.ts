import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import {
	ClassificationDialogComponent,
	IDocsUploadDialogResult
} from '../../dialogs/classification-dialog.component';
import { CreateDialogComponent } from '../../dialogs/create-dialog.component';
import {
	ILegacyImportDialogResult,
	LegacyImportDialogComponent
} from '../../dialogs/legacy-import-dialog.component';
import {
	createInitialDocsFilterState,
	DocsFilterState,
	hasActiveFilters,
	parseDocsFilterFromParams
} from '../../models/docs-filter.model';
import { DocsEmptyVariant } from '../../components/empty/empty-state.component';
import { DocumentTreeStore } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';
import { UploadQueueService } from '../../services/upload-queue.service';

/**
 * Browse page orchestrator: owns URL restore, the table ↔ cards view toggle
 * (persisted via `ComponentEnum.DOCUMENTS_HUB`, `?view=` overrides for one load),
 * the cards breadcrumb + "Load more" paging, the preview modal, the upload flow
 * (`?upload=1` / `?newPage=1` one-shot deep links), selection and the processing
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
	@ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;

	public readonly query = this.documentsQuery;
	public readonly uploadAccept = DOCS_UPLOAD_ACCEPT;
	public readonly permissions = PermissionsEnum;
	public readonly layoutStyles = ComponentLayoutStyleEnum;
	public dataLayoutStyle: ComponentLayoutStyleEnum = ComponentLayoutStyleEnum.TABLE;
	public dropActive = false;
	public canManage = false;
	/** Ancestor chain of the current tree location, rendered above the cards grid. */
	public breadcrumb: IDocsCardsCrumb[] = [];
	/** Live query params, handed to the saved-views control (UX spec §5). */
	public urlParams: Params = {};
	/** Nebular menu tag of the header overflow menu — scopes its click stream to this page. */
	public readonly overflowMenuTag = 'docs-browse-overflow';
	/**
	 * Header overflow items (`DOCS_MANAGE`-only). Rebuilt on language change rather than
	 * recomputed in the binding: `nbContextMenu` reacts to a new array reference, so a getter
	 * would rebuild the overlay on every change-detection pass.
	 */
	public overflowMenu: NbMenuItem[] = [];

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

		// 7) Mirror the live query string for the saved-views control.
		this.route.queryParams.pipe(untilDestroyed(this)).subscribe((params) => (this.urlParams = params ?? {}));

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
							max: this.humanizeBytes(this.uploadQueue.maxFileSizeBytes)
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
		//     toast straight to the review queue (§7.3).
		this.uploadQueue.documentReady$
			.pipe(untilDestroyed(this))
			.subscribe((document) => this.notifyIfNeedsReview(document));

		this.canManage = this.store.hasPermission(PermissionsEnum.DOCS_MANAGE);

		// 9) Header overflow menu: build it, keep it translated, and act on its clicks.
		this.buildOverflowMenu();
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => this.buildOverflowMenu());
		this.nbMenuService
			.onItemClick()
			.pipe(
				filter(({ tag }) => tag === this.overflowMenuTag),
				untilDestroyed(this)
			)
			.subscribe(({ item }) => {
				const action = (item as NbMenuItem & { data?: { action?: string } }).data?.action;
				if (action === 'import-legacy') {
					// A menu click cannot be awaited; the dialog owns its own failure path.
					void this.openLegacyImportDialog();
				}
			});
	}

	ngOnDestroy(): void {
		// UntilDestroy handles subscriptions.
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

	openPreview(document: IDocument): void {
		this.dialogService.open(DocsPreviewModalComponent, { ...DOCS_PREVIEW_DIALOG_CONFIG, context: { document } });
	}

	openEditor(document: IDocument): void {
		this.router.navigate(['page', document.id], { relativeTo: this.route });
	}

	/**
	 * Resolves the breadcrumb for the current tree location from the shared node
	 * cache; when the ancestors were never loaded (deep link straight into a
	 * folder) it falls back to the document itself plus its `parent` relation.
	 * Unresolvable ancestors are not invented — the root crumb still gets back out.
	 */
	private async refreshBreadcrumb(folderId: ID | null): Promise<void> {
		if (!folderId) {
			this.breadcrumb = [];
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

	// ─── URL restore ─────────────────────────────────────────────

	private restoreFromUrl(): void {
		const params = this.route.snapshot.queryParams;
		this.applyStateFromParams(params);

		// One-shot deep links: consume + strip with a replaceUrl write.
		if (params['upload'] === '1') {
			// `?upload=1` uploads into the folder the URL scoped us to.
			this.pendingUploadFolder = this.documentsQuery.folderId;
			this.stripOneShotParams();
			setTimeout(() => this.openUploadFlow());
		} else if (params['newPage'] === '1') {
			this.stripOneShotParams();
			setTimeout(() => this.openNewPageDialog());
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
			queryParams: { upload: null, newPage: null },
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
		const created = await firstValueFrom(
			this.dialogService.open(CreateDialogComponent, {
				context: { kind: DocumentKindEnum.PAGE, parentId: this.documentsQuery.folderId }
			}).onClose
		);
		if (created) {
			this.router.navigate(['page', created.id], { relativeTo: this.route });
		}
	}

	goToReviewQueue(): void {
		this.router.navigate(['review'], { relativeTo: this.route });
	}

	// ─── Header overflow menu ────────────────────────────────────

	/** The single admin action so far — kept in a method so the labels re-translate. */
	private buildOverflowMenu(): void {
		this.overflowMenu = [
			{
				title: this.getTranslation('DOCS.MIGRATION.MENU_ITEM'),
				icon: 'swap-outline',
				data: { action: 'import-legacy' }
			}
		];
	}

	/**
	 * Legacy consolidation dialog (`09-consolidation-migration.md` §10.4).
	 *
	 * The list and the tree are re-queried only when the run actually wrote something: a dry
	 * run, a cancelled confirmation or a rollback that removed nothing all leave the hub
	 * exactly as it was. A dialog **dismissed** with `Esc` resolves `undefined` instead of a
	 * result, and that case refreshes — the alternative is leaving a freshly imported tree
	 * invisible until the next navigation.
	 *
	 * Backdrop clicks are disabled: a run takes as long as the legacy data is big, and losing
	 * the report to a stray click outside the card would mean re-running to see it again.
	 */
	async openLegacyImportDialog(): Promise<void> {
		const result: ILegacyImportDialogResult | undefined = await firstValueFrom(
			this.dialogService.open(LegacyImportDialogComponent, {
				closeOnBackdropClick: false,
				closeOnEsc: true
			}).onClose
		);
		if (result && !result.changed) return;
		this.documentTreeStore.invalidateAll();
		this.actions.dispatch(DocumentsActions.loadDocuments());
	}

	/** Byte formatter for upload toasts (same rounding as the detail panel). */
	private humanizeBytes(bytes: number): string {
		if (!bytes) return '—';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
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
			case 'clear-filters':
				this.onClearAll();
				break;
			case 'retry':
				this.actions.dispatch(DocumentsActions.loadDocuments());
				break;
		}
	}
}
