import { CommonModule } from '@angular/common';
import {
	ChangeDetectorRef,
	Component,
	DestroyRef,
	HostListener,
	OnDestroy,
	OnInit,
	ViewChild,
	inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Actions } from '@ngneat/effects-ng';
import { NgxPermissionsModule } from 'ngx-permissions';
import { distinctUntilChanged, filter, firstValueFrom, map } from 'rxjs';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	DocumentReviewStatusEnum,
	IDocument,
	PermissionsEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { FavoriteToggleModule } from '@gauzy/ui-core/shared';
import { DocumentsActions } from '../../+state/documents.actions';
import { DocumentEditorComponent, IEditorStats, ITocAnchor } from '../../editor/document-editor.component';
import { DocsSaveState } from '../../editor/services/document-autosave.service';
import { DocumentStaticViewComponent } from '../../editor/read-only/document-static-view.component';
import { VersionHistoryPanelComponent } from '../../editor/version-history/version-history-panel.component';
import { MoveDialogComponent } from '../../dialogs/move-dialog.component';
import { RequestReviewDialogComponent } from '../../dialogs/request-review-dialog.component';
import { DocumentShareDialogComponent } from '../../dialogs/share-dialog.component';
import { DocsExportService } from '../../services/docs-export.service';
import { DocumentTreeStore, IDocsTreeNode } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';

type RailTab = 'toc' | 'info';

/**
 * Page editor chrome (UX spec §10 / spec 04 §4.8) hosting `gz-document-editor`:
 * breadcrumbs, icon + inline title, favorite star, lock toggle, autosave pill,
 * overflow menu (full width, copy link/markdown, save version now, invisibles,
 * duplicate, move, archive, version history), ToC + Info right rail, conflict /
 * locked / read-only banners. Lazily loaded — the whole editor stack is one
 * chunk behind this route (spec 05 §12).
 */
@Component({
	selector: 'gz-docs-page',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		RouterModule,
		TranslateModule,
		NgxPermissionsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		FavoriteToggleModule,
		DocumentEditorComponent,
		DocumentStaticViewComponent,
		VersionHistoryPanelComponent
	],
	templateUrl: './document-page.component.html',
	styleUrls: ['./document-page.component.scss']
})
export class DocumentPageComponent implements OnInit, OnDestroy {
	@ViewChild(DocumentEditorComponent) editorComponent?: DocumentEditorComponent;

	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly documentsService = inject(DocumentsService);
	private readonly exportService = inject(DocsExportService);
	private readonly treeStore = inject(DocumentTreeStore);
	private readonly dialogService = inject(NbDialogService);
	private readonly toastrService = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly store = inject(Store);
	private readonly actions = inject(Actions);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	public readonly favoriteEntity = BaseEntityEnum.Document;
	public readonly PermissionsEnum = PermissionsEnum;

	public document: IDocument | null = null;
	public loading = false;
	public loadError = false;

	public saveState: DocsSaveState = 'idle';
	public stats: IEditorStats | null = null;
	public tocAnchors: ITocAnchor[] = [];
	public breadcrumbs: IDocsTreeNode[] = [];

	public railTab: RailTab = 'toc';
	public railOpen = true;
	public versionsOpen = false;
	public menuOpen = false;
	public iconPickerOpen = false;
	public fullWidth = false;

	public titleDraft = '';
	public iconDraft = '';

	get canUpdate(): boolean {
		return this.store.hasAnyPermission(PermissionsEnum.DOCS_UPDATE);
	}

	get isLocked(): boolean {
		return !!this.document?.isLocked || this.saveState === 'locked';
	}

	get editable(): boolean {
		return this.canUpdate && !this.isLocked && this.saveState !== 'conflict' && !this.document?.archivedAt;
	}

	get isPage(): boolean {
		return this.document?.kind === DocumentKindEnum.PAGE;
	}

	get isPendingReview(): boolean {
		return this.document?.reviewStatus === DocumentReviewStatusEnum.PENDING;
	}

	/**
	 * A manual review request is what makes the queue reachable with AI off, so
	 * the editor offers it too — but never while the document is already PENDING
	 * (the menu shows that state instead; the backend would no-op) nor once it is
	 * archived.
	 */
	get canRequestReview(): boolean {
		return !!this.document && !this.isPendingReview && !this.document.archivedAt;
	}

	ngOnInit(): void {
		// The route parameter is the single trigger for loading. Angular reuses this
		// component instance across `page/:id` navigations (duplicate, breadcrumb, a
		// mention link), so anything that navigates only has to navigate — the old
		// `setTimeout(() => load())` hacks raced the router and are gone.
		this.route.paramMap
			.pipe(
				map((params) => params.get('id')),
				filter((id): id is string => !!id),
				distinctUntilChanged(),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((id) => void this.load(id));
	}

	ngOnDestroy(): void {
		// Best-effort flush of pending edits when leaving the route.
		void this.editorComponent?.flush();
	}

	/** Flush while dirty on tab close (spec 05 §9.2 beforeunload guard). */
	@HostListener('window:beforeunload', ['$event'])
	onBeforeUnload(event: BeforeUnloadEvent): void {
		if (this.editorComponent?.autosave.isDirty) {
			void this.editorComponent.flush();
			event.preventDefault();
		}
	}

	@HostListener('document:visibilitychange')
	onVisibilityChange(): void {
		if (document.visibilityState === 'hidden') void this.editorComponent?.flush();
	}

	// ─── Loading ─────────────────────────────────────────────────

	async load(id: string | null = this.route.snapshot.paramMap.get('id')): Promise<void> {
		if (!id) return;
		const switching = !!this.document && String(this.document.id) !== String(id);
		// Pending edits belong to the document being left — save them while the
		// editor still holds it, never after the input has been swapped.
		if (switching) await this.editorComponent?.flush();
		this.loading = true;
		this.loadError = false;
		if (switching) {
			// Per-document chrome must not survive the swap.
			this.saveState = 'idle';
			this.stats = null;
			this.tocAnchors = [];
			this.breadcrumbs = [];
			this.versionsOpen = false;
			this.menuOpen = false;
		}
		try {
			this.document = await firstValueFrom(this.documentsService.getById(id, ['categories', 'tags']));
			this.titleDraft = this.document?.name ?? '';
			this.iconDraft = this.document?.icon ?? '';
			await this.loadBreadcrumbs();
		} catch {
			this.loadError = true;
		} finally {
			this.loading = false;
			this.cdr.markForCheck();
		}
	}

	private async loadBreadcrumbs(): Promise<void> {
		if (!this.document) return;
		try {
			// Walk ancestors into the tree store cache so pathOf resolves.
			await this.treeStore.loadRoots();
			let parentId = this.document.parentId ?? null;
			const guard = new Set<string>();
			while (parentId && !guard.has(String(parentId))) {
				guard.add(String(parentId));
				const node = this.treeStore.getNode(parentId);
				await this.treeStore.loadChildren(parentId);
				parentId = node?.parentId ?? null;
			}
			this.breadcrumbs = this.document.parentId ? this.treeStore.pathOf(this.document.parentId) : [];
		} catch {
			this.breadcrumbs = [];
		}
	}

	// ─── Editor events ───────────────────────────────────────────

	onSaveStateChanged(state: DocsSaveState): void {
		this.saveState = state;
		this.cdr.markForCheck();
	}

	onStatsChanged(stats: IEditorStats): void {
		this.stats = stats;
		this.cdr.markForCheck();
	}

	onTocChanged(anchors: ITocAnchor[]): void {
		this.tocAnchors = anchors;
		this.cdr.markForCheck();
	}

	scrollToAnchor(anchor: ITocAnchor): void {
		anchor.dom?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ─── Title / icon (autosaved separately from content — rename never bumps content versions) ──

	async saveTitle(): Promise<void> {
		const name = this.titleDraft.trim();
		if (!this.document || !name || name === this.document.name) {
			this.titleDraft = this.document?.name ?? '';
			return;
		}
		try {
			this.document = await firstValueFrom(this.documentsService.update(this.document.id, { name }));
			this.treeStore.invalidate(this.document.parentId ?? null);
			this.toastrService.success(this.translate.instant('DOCS.TOASTS.RENAMED'));
		} catch {
			this.titleDraft = this.document?.name ?? '';
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
		this.cdr.markForCheck();
	}

	async saveIcon(): Promise<void> {
		this.iconPickerOpen = false;
		const icon = this.iconDraft.trim();
		if (!this.document || icon === (this.document.icon ?? '')) return;
		try {
			this.document = await firstValueFrom(this.documentsService.update(this.document.id, { icon }));
			this.treeStore.invalidate(this.document.parentId ?? null);
		} catch {
			this.iconDraft = this.document?.icon ?? '';
		}
		this.cdr.markForCheck();
	}

	// ─── Actions (⋯ menu) ────────────────────────────────────────

	async toggleLock(): Promise<void> {
		if (!this.document) return;
		this.menuOpen = false;
		try {
			this.document = await firstValueFrom(
				// `isLocked` is accepted by the metadata update endpoint (UpdateDocumentDTO).
				this.documentsService.update(this.document.id, { isLocked: !this.document.isLocked } as never)
			);
			// A save that hit the lock froze autosave with a 423; releasing the lock
			// here is the only thing short of a reload that can thaw it.
			if (!this.document?.isLocked) this.editorComponent?.lockReleased(this.document);
			this.toastrService.success(this.translate.instant('DOCS.TOASTS.UPDATED'));
		} catch {
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
		this.cdr.markForCheck();
	}

	async copyLink(): Promise<void> {
		this.menuOpen = false;
		await navigator.clipboard.writeText(window.location.href);
		this.toastrService.success(this.translate.instant('DOCS.TOASTS.LINK_COPIED'));
	}

	/**
	 * Copy / download / print all share one resolution path
	 * (`DocsExportService`), fed the live editor output when an editor is
	 * mounted. Handing it `markdown`/`html` from the editor keeps the export
	 * byte-identical to what the user is looking at — including edits that have
	 * not been autosaved yet — and skips the refetch + static re-render entirely.
	 */
	private exportSource(): { markdown?: string | null; html?: string | null } {
		return this.isPage
			? { markdown: this.editorComponent?.getMarkdown(), html: this.editorComponent?.getHTML() }
			: {};
	}

	async copyMarkdown(): Promise<void> {
		this.menuOpen = false;
		if (!this.document) return;
		const copied = await this.exportService.copyMarkdown(this.document, this.exportSource());
		this.toastrService.success(
			this.translate.instant(copied ? 'DOCS.TOASTS.MARKDOWN_COPIED' : 'DOCS.EXPORT.NOTHING_TO_EXPORT')
		);
	}

	/** Downloads the page as a `.md` file (spec 01 §10.9 "Export (Markdown now)"). */
	async exportMarkdown(): Promise<void> {
		this.menuOpen = false;
		if (!this.document) return;
		const written = await this.exportService.downloadMarkdown(this.document, this.exportSource());
		if (!written) this.toastrService.warning(this.translate.instant('DOCS.EXPORT.NOTHING_TO_EXPORT'));
	}

	/** Print-CSS PDF path (spec 05 §9.1 tier 3 — the browser's "Save as PDF"). */
	async print(): Promise<void> {
		this.menuOpen = false;
		if (!this.document) return;
		const printed = await this.exportService.print(this.document, this.exportSource());
		if (!printed) this.toastrService.warning(this.translate.instant('DOCS.EXPORT.NOTHING_TO_EXPORT'));
	}

	/** Share overlay + visibility toggle (spec 08 §3). */
	openShareDialog(): void {
		if (!this.document) return;
		this.menuOpen = false;
		this.dialogService
			.open(DocumentShareDialogComponent, { context: { document: this.document } })
			.onClose.subscribe((updated: IDocument | null) => {
				if (updated) {
					this.document = { ...this.document, ...updated };
					this.cdr.markForCheck();
				}
			});
	}

	async saveVersionNow(): Promise<void> {
		this.menuOpen = false;
		await this.editorComponent?.flush({ forceSnapshot: true });
	}

	toggleInvisibles(): void {
		this.menuOpen = false;
		this.editorComponent?.toggleInvisibleCharacters();
	}

	toggleFullWidth(): void {
		this.menuOpen = false;
		this.fullWidth = !this.fullWidth;
	}

	async duplicate(): Promise<void> {
		if (!this.document) return;
		this.menuOpen = false;
		try {
			const copy = await firstValueFrom(this.documentsService.duplicate(this.document.id));
			this.treeStore.invalidate(this.document.parentId ?? null);
			this.toastrService.success(this.translate.instant('DOCS.TOASTS.DUPLICATED'));
			// The ':id' change is what reloads — see `ngOnInit`.
			void this.router.navigate(['..', copy.id], { relativeTo: this.route });
		} catch {
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
	}

	openMoveDialog(): void {
		if (!this.document) return;
		this.menuOpen = false;
		this.dialogService
			.open(MoveDialogComponent, { context: { documentIds: [this.document.id] } })
			.onClose.subscribe((moved) => {
				if (moved) void this.load();
			});
	}

	/**
	 * Flags the page for a human review (`reviewReason='manual'`, optional reason)
	 * — spec 01 §11. Patches the browse row and re-counts the facets so the
	 * "Needs review" preset and the queue pick it up without a reload.
	 */
	async requestReview(): Promise<void> {
		if (!this.canRequestReview || !this.document) return;
		this.menuOpen = false;
		const result: { reason?: string } | null = await firstValueFrom(
			this.dialogService.open(RequestReviewDialogComponent).onClose
		);
		if (!result) return;
		try {
			const document = await firstValueFrom(
				this.documentsService.requestReview(this.document.id, { reason: result.reason })
			);
			this.document = { ...this.document, ...document };
			this.toastrService.success(this.translate.instant('DOCS.TOASTS.REVIEW_REQUESTED'));
			this.actions.dispatch(DocumentsActions.rowChanged(this.document));
			this.actions.dispatch(DocumentsActions.refreshFacets());
		} catch {
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
		this.cdr.markForCheck();
	}

	async archive(): Promise<void> {
		if (!this.document) return;
		this.menuOpen = false;
		try {
			await firstValueFrom(this.documentsService.archive(this.document.id));
			this.treeStore.invalidate(this.document.parentId ?? null);
			this.toastrService.success(this.translate.instant('DOCS.TOASTS.ARCHIVED'));
			this.back();
		} catch {
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
	}

	openVersions(): void {
		this.menuOpen = false;
		this.versionsOpen = true;
		this.railOpen = true;
	}

	onVersionRestored(document: IDocument): void {
		this.document = { ...this.document, ...document };
		this.editorComponent?.applyRemoteContent(document);
		this.cdr.markForCheck();
	}

	// ─── Conflict resolution (spec 05 §9.2 — no silent merge in v1) ──

	async conflictReload(): Promise<void> {
		if (!this.document) return;
		try {
			const fresh = await firstValueFrom(this.documentsService.getById(this.document.id));
			this.document = fresh;
			this.editorComponent?.applyRemoteContent(fresh);
		} catch {
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
		this.cdr.markForCheck();
	}

	/** Duplicates the local (unsaved) content as a new PAGE sibling, then reloads. */
	async conflictKeepCopy(): Promise<void> {
		if (!this.document || !this.editorComponent) return;
		try {
			const { id: organizationId, tenantId } = this.store.selectedOrganization ?? ({} as never);
			// The copy is created for its side effect only — the editor stays on this
			// document and reloads the server's version below.
			await firstValueFrom(
				this.documentsService.create({
					kind: DocumentKindEnum.PAGE,
					name: `${this.document.name} (${this.translate.instant('DOCS.EDITOR.CONFLICT_COPY_SUFFIX')})`,
					parentId: this.document.parentId ?? undefined,
					contentJson: this.editorComponent.getJSON() ?? undefined,
					contentHtml: this.editorComponent.getHTML(),
					organizationId,
					tenantId
				})
			);
			this.treeStore.invalidate(this.document.parentId ?? null);
			this.toastrService.success(this.translate.instant('DOCS.TOASTS.CREATED'));
			await this.conflictReload();
		} catch {
			this.toastrService.danger(this.translate.instant('DOCS.ERRORS.GENERIC_RETRY'));
		}
	}

	back(): void {
		void this.router.navigate(['..', '..'], { relativeTo: this.route });
	}

	openBreadcrumb(node: IDocsTreeNode): void {
		if (node.kind === DocumentKindEnum.PAGE) {
			// The ':id' change is what reloads — see `ngOnInit`.
			void this.router.navigate(['..', node.id], { relativeTo: this.route });
		} else {
			void this.router.navigate(['../..'], { relativeTo: this.route, queryParams: { folder: node.id } });
		}
	}
}
