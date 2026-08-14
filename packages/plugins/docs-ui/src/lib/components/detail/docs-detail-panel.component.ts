import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Actions } from '@ngneat/effects-ng';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID,
	IDocument,
	IDocumentCategory,
	IDocumentLink,
	IDocumentUpdateInput,
	ITag,
	ITagCreateInput,
	IUser,
	PermissionsEnum
} from '@gauzy/contracts';
import { Store, TagsService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsActions } from '../../+state/documents.actions';
import { findLinkEntityDescriptor } from '../../models/docs-link.model';
import { DocsExportService } from '../../services/docs-export.service';
import { DocumentPermissionService } from '../../services/document-permission.service';
import { DocumentTreeStore } from '../../services/document-tree.store';
import { DocumentsService } from '../../services/documents.service';
import { UploadDuplicateNotice, UploadQueueService } from '../../services/upload-queue.service';
import {
	DocsDeleteDialogComponent,
	IDocsDeleteDialogResult
} from '../../dialogs/delete-dialog.component';
import { ExtractedTextDialogComponent } from '../../dialogs/extracted-text-dialog.component';
import { DocumentLinkDialogComponent } from '../../dialogs/link-dialog.component';
import { RequestReviewDialogComponent } from '../../dialogs/request-review-dialog.component';
import { DocumentShareDialogComponent } from '../../dialogs/share-dialog.component';
import { DOCS_PERMISSIONS } from '../../docs-permission-groups';

/**
 * Relations the panel needs on the detail read.
 *
 * `createdByUser` / `updatedByUser` back the Created/Updated rows of the metadata grid
 * (`01-ux-spec.md` §8.4) — only the id columns are stored on the row, so the names have to be
 * joined. 🛑 They must stay on the server-side relation allowlist (`document.controller.ts`
 * `toRelationList`); a relation that is filtered out silently degrades those rows to a bare
 * timestamp rather than erroring.
 */
export const DOCS_DETAIL_RELATIONS = [
	'categories',
	'tags',
	'parent',
	'reviewedBy',
	'createdByUser',
	'updatedByUser'
];

/**
 * Palette the accept-chip picks a colour from when it has to create a `Tag`.
 *
 * Deterministic (hashed from the name) rather than random: accepting the same suggestion on two
 * documents in two organizations produces the same colour, and the plugin does not have to take
 * a dependency on `randomcolor` for it.
 */
const SUGGESTED_TAG_COLORS = ['#3366FF', '#00D68F', '#FFAA00', '#FF3D71', '#8B5CF6', '#0095FF', '#00B383'];

/**
 * Right-side detail panel for any document kind. Re-fetches by id on open
 * (list rows can be stale) and loads links in parallel. Taxonomy chip edits
 * PUT immediately; the review banner hides itself when approve/reject
 * return 403.
 */
@Component({
	selector: 'gz-docs-detail-panel',
	templateUrl: './docs-detail-panel.component.html',
	styleUrls: ['./docs-detail-panel.component.scss'],
	standalone: false
})
export class DocsDetailPanelComponent extends TranslationBaseComponent implements OnChanges {
	/**
	 * Stable permission arrays for the template's `*ngxPermissionsOnly` gates.
	 * 🛑 Never inline `[permissions.X]` in a binding — a fresh array each change-detection cycle
	 * makes ngx-permissions re-validate forever and wedges the main thread.
	 */
	public readonly docsPermissions = DOCS_PERMISSIONS;

	@Input() documentId: ID;

	@Output() closed = new EventEmitter<void>();
	@Output() changed = new EventEmitter<IDocument>();
	@Output() deleted = new EventEmitter<ID>();
	@Output() openEditor = new EventEmitter<ID>();
	/** FILE preview request — the shell opens the preview modal. */
	@Output() openPreview = new EventEmitter<IDocument>();

	public document: IDocument | null = null;
	public links: IDocumentLink[] = [];
	public categories: IDocumentCategory[] = [];
	public loading = false;
	public loadError = false;
	/** Hidden after a 403 from approve/reject. */
	public reviewForbidden = false;
	/**
	 * Ancestor chain of the open document, root → parent (`01-ux-spec.md` §8.4 "Location").
	 * Empty for a root-level document, which renders the "All documents" crumb instead.
	 */
	public location: Array<{ id: ID; name: string }> = [];
	/** The suggested tag currently being accepted — one chip at a time, so clicks cannot race. */
	public acceptingTag: string | null = null;

	public readonly kindEnum = DocumentKindEnum;
	public readonly statusEnum = DocumentStatusEnum;
	public readonly knowledgeEnum = DocumentKnowledgeStatusEnum;
	public readonly reviewEnum = DocumentReviewStatusEnum;
	public readonly visibilityEnum = DocumentVisibilityEnum;
	public readonly permissions = PermissionsEnum;
	public readonly favoriteEntityType = BaseEntityEnum.Document;

	/** True while a markdown/print export is resolving (dialog-free async work). */
	public exporting = false;
	/** True while the signed download URL is being resolved. */
	public downloading = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly documentsService: DocumentsService,
		private readonly exportService: DocsExportService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly actions: Actions,
		private readonly router: Router,
		private readonly uploadQueue: UploadQueueService,
		private readonly documentTreeStore: DocumentTreeStore,
		private readonly tagsService: TagsService,
		private readonly documentPermission: DocumentPermissionService,
		private readonly store: Store
	) {
		super(translateService);
	}

	/**
	 * Dedup notice for the open document (`R-UPL-04`).
	 *
	 * 🛑 `duplicateOfId` is reported on the **upload response only** — it is not a
	 * column on the document — so the upload queue is the only place that knows it.
	 * A document opened on a later page load therefore correctly shows nothing;
	 * that is the storage model, not a missing render.
	 */
	get duplicateNotice(): UploadDuplicateNotice | null {
		return this.uploadQueue.duplicateNoticeFor(this.document?.id as ID);
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['documentId'] && this.documentId) {
			this.reviewForbidden = false;
			this.acceptingTag = null;
			this.location = [];
			void this.reload();
		}
	}

	async reload(): Promise<void> {
		this.loading = true;
		this.loadError = false;
		try {
			const [document, links, categories] = await Promise.all([
				firstValueFrom(this.documentsService.getById(this.documentId, DOCS_DETAIL_RELATIONS)),
				firstValueFrom(this.documentsService.getLinks(this.documentId).pipe(catchError(() => of([])))),
				firstValueFrom(this.documentsService.getCategories().pipe(catchError(() => of([]))))
			]);
			this.document = document;
			this.links = links ?? [];
			this.categories = categories ?? [];
			// Fault-isolated like the links/categories legs above: no ancestor chain is a
			// missing "Location" row, never a failed panel.
			void this.refreshLocation(document);
		} catch {
			this.loadError = true;
			this.document = null;
			this.location = [];
		} finally {
			this.loading = false;
		}
	}

	// ─── Header / actions ────────────────────────────────────────

	close(): void {
		this.closed.emit();
	}

	get isArchived(): boolean {
		return !!(this.document as IDocument & { isArchived?: boolean })?.isArchived;
	}

	/**
	 * Row-level ownership scope of the open document (`08-permissions-security.md` §1.7).
	 *
	 * 🛑 ANDed with the template's `ngxPermissionsOnly` gates, never a replacement for them: the
	 * server rule is `DOCS_UPDATE AND (DOCS_MANAGE OR creator OR EDIT share)`, so a `DOCS_UPDATE`
	 * holder who is not the creator was being shown edit/archive/delete on every document and
	 * only found out from a `403 DOCS_WRITE_FORBIDDEN`.
	 */
	get canMutate(): boolean {
		return this.documentPermission.canMutate(this.document);
	}

	get isSettledFile(): boolean {
		return (
			this.document?.kind === DocumentKindEnum.FILE &&
			(this.document.status === DocumentStatusEnum.READY || this.document.status === DocumentStatusEnum.FAILED)
		);
	}

	/**
	 * Resolves the short-lived provider URL, then opens it.
	 *
	 * 🛑 `GET /:id/download` is a **JWT-guarded JSON endpoint** answering
	 * `{ url }`, not a redirect: navigating straight to it sends no bearer token
	 * and lands on a 401 page. The signed URL therefore has to come back through
	 * the authenticated `HttpClient` first — which is exactly what
	 * `getDownloadUrl()` is for.
	 */
	async download(): Promise<void> {
		if (!this.document || this.downloading) return;
		this.downloading = true;
		try {
			const url = await firstValueFrom(this.documentsService.getDownloadUrl(this.document.id as ID));
			if (url) window.open(url, '_blank', 'noopener');
			else this.toastrService.warning(this.getTranslation('DOCS.PREVIEW.FALLBACK_BODY'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.downloading = false;
		}
	}

	onOpenEditor(): void {
		if (this.document?.kind === DocumentKindEnum.PAGE) {
			this.openEditor.emit(this.document.id as ID);
		}
	}

	preview(): void {
		if (this.document?.kind === DocumentKindEnum.FILE) {
			this.openPreview.emit(this.document);
		}
	}

	async reprocess(): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(this.documentsService.reprocess(this.document.id as ID));
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async toggleArchive(): Promise<void> {
		if (!this.document) return;
		const id = this.document.id as ID;
		try {
			const document = this.isArchived
				? await firstValueFrom(this.documentsService.unarchive(id))
				: await firstValueFrom(this.documentsService.archive(id));
			this.toastrService.success(
				this.getTranslation(this.isArchived ? 'DOCS.TOASTS.RESTORED' : 'DOCS.TOASTS.ARCHIVED')
			);
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * Delete is allowed only from the archived state (archive-first flow).
	 *
	 * The prompt (`01-ux-spec.md` §10.11) is what decides the strategy: a node with
	 * children offers subtree-vs-promote, a leaf just confirms. This used to open
	 * the generic confirmation and then hardcode `promote-children` — under a query
	 * param the backend does not declare, so the request was stripped to the
	 * `subtree` default and did the opposite of what the code claimed.
	 */
	async remove(): Promise<void> {
		if (!this.document || !this.isArchived) return;
		const id = this.document.id as ID;
		const result: IDocsDeleteDialogResult | null = await firstValueFrom(
			this.dialogService.open(DocsDeleteDialogComponent, {
				context: {
					target: { id, name: this.document.name, kind: this.document.kind }
				}
			}).onClose
		);
		if (!result?.strategy) return;
		try {
			await firstValueFrom(this.documentsService.delete(id, { strategy: result.strategy }));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.DELETED'));
			this.deleted.emit(id);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async openExtractedText(): Promise<void> {
		if (!this.document) return;
		const document = await firstValueFrom(
			this.dialogService.open(ExtractedTextDialogComponent, {
				context: { documentId: this.document.id as ID }
			}).onClose
		);
		if (document) this.applyChange(document);
	}

	// ─── Taxonomy (immediate PUTs) ───────────────────────────────

	async onCategoriesChange(categoryIds: ID[]): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(
				this.documentsService.update(this.document.id as ID, { categoryIds })
			);
			this.applyChange({ ...document, categories: this.categories.filter((c) => categoryIds.includes(c.id as ID)) });
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async onTagsChange(tags: ITag[]): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(
				this.documentsService.update(this.document.id as ID, this.toTagIdsInput(tags))
			);
			this.applyChange({ ...document, tags });
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * Builds the tag half of a `PUT /documents/:id` body.
	 *
	 * 🛑 The server DTO whitelists **`tagIds`**, not `tags` (`create-document.dto.ts:83-87`), and
	 * the route runs with `forbidNonWhitelisted: true` — so sending the `ITag[]` that
	 * `IDocumentUpdateInput` advertises is a **400**, not a silently ignored field. The FE
	 * contract and the DTO disagree here; the DTO wins, and the cast documents why.
	 */
	private toTagIdsInput(tags: ITag[]): IDocumentUpdateInput {
		const input: IDocumentUpdateInput & { tagIds: ID[] } = {
			tagIds: (tags ?? []).map((tag) => tag.id as ID).filter(Boolean)
		};
		return input;
	}

	/** Cache so `selectedCategoryIds` keeps a stable reference across change-detection cycles. */
	private selectedCategoryIdsCache: { source: unknown; result: ID[] } = { source: undefined, result: [] };

	/**
	 * Feeds `[selected]` on an `<nb-select>`, re-read every change-detection cycle while the panel
	 * is open. `.map()` mints a new array identity each call; memoizing it (keyed on the
	 * `document.categories` reference) keeps that reference stable so nb-select does not re-reconcile
	 * its selection model every cycle — the same discipline as `FacetMultiselectComponent`.
	 */
	get selectedCategoryIds(): ID[] {
		const source = this.document?.categories;
		if (this.selectedCategoryIdsCache.source !== source) {
			this.selectedCategoryIdsCache = {
				source,
				result: (source ?? []).map((category) => category.id as ID)
			};
		}
		return this.selectedCategoryIdsCache.result;
	}

	// ─── AI suggested tags (spec 07 §5.2) ────────────────────────

	/**
	 * `metadata` as an object.
	 *
	 * The column is `jsonb` on postgres but **text** on sqlite; `DocumentSubscriber.afterEntityLoad`
	 * normally parses that back, but it logs-and-leaves the raw string when the parse fails — and
	 * the classifier writes the column through a raw `.update()` that bypasses the subscribers
	 * entirely. So the string shape can reach this client, and reading it wrong means the accept
	 * chips silently never appear.
	 */
	private get metadata(): Record<string, unknown> | null {
		const raw = this.document?.metadata as unknown;
		if (typeof raw === 'string') {
			try {
				const parsed = JSON.parse(raw);
				return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
			} catch {
				return null;
			}
		}
		return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
	}

	/**
	 * AI keyword suggestions that are not already applied.
	 *
	 * The pipeline deliberately never creates `Tag` rows itself (catalog hygiene, spec 07 §5.2),
	 * so these chips are the ONLY path from `metadata.ai.suggestedTags` to a real tag. A chip
	 * disappears as soon as its name is on the document, which is what makes "accept" feel like
	 * an accept rather than a toggle.
	 */
	/** Cache so `suggestedTags` keeps a stable reference (and skips the Set-building work) per CD. */
	private suggestedTagsCache: { suggestions: unknown; appliedTags: unknown; result: string[] } = {
		suggestions: undefined,
		appliedTags: undefined,
		result: []
	};

	/**
	 * Rebuilds a new array plus two `Set`s on every call and is read each change-detection cycle
	 * while the panel is open. Memoized on its two source references (the AI `suggestedTags` array
	 * and the applied `document.tags`) so it returns a stable array — the `trackBy` on its `*ngFor`
	 * then keeps the suggestion buttons stable. Same reference-stability discipline as the facet fix.
	 */
	get suggestedTags(): string[] {
		const ai = this.metadata?.['ai'] as { suggestedTags?: unknown } | undefined;
		const suggestions = Array.isArray(ai?.suggestedTags) ? ai?.suggestedTags : [];
		const appliedTags = this.document?.tags;
		if (this.suggestedTagsCache.suggestions === suggestions && this.suggestedTagsCache.appliedTags === appliedTags) {
			return this.suggestedTagsCache.result;
		}

		const applied = new Set((appliedTags ?? []).map((tag) => String(tag?.name ?? '').trim().toLowerCase()));
		const seen = new Set<string>();
		const result = (suggestions as unknown[])
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim())
			.filter((entry) => {
				const key = entry.toLowerCase();
				if (!entry || applied.has(key) || seen.has(key)) return false;
				seen.add(key);
				return true;
			});

		this.suggestedTagsCache = { suggestions, appliedTags, result };
		return result;
	}

	trackBySuggestion(_index: number, suggestion: string): string {
		return suggestion;
	}

	/**
	 * Accepts one suggestion: resolve-or-create the `Tag` by name, then PUT the merged id list.
	 *
	 * Reuse comes first on purpose — a suggestion that matches an existing organization tag must
	 * attach that tag, not mint a near-duplicate the catalog then has to live with.
	 */
	async acceptSuggestedTag(name: string): Promise<void> {
		if (!this.document || this.acceptingTag) return;
		this.acceptingTag = name;
		try {
			const tag = await this.resolveOrCreateTag(name);
			const tags = [...(this.document.tags ?? []), tag];
			const document = await firstValueFrom(
				this.documentsService.update(this.document.id as ID, this.toTagIdsInput(tags))
			);
			// `applyChange` merges, so the local `tags` array is what removes the chip — the PUT
			// response carries no `tags` relation.
			this.applyChange({ ...document, tags });
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.TAG_ADDED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.acceptingTag = null;
		}
	}

	/** Case-insensitive lookup in the organization's tag catalog, creating the tag only on a miss. */
	private async resolveOrCreateTag(name: string): Promise<ITag> {
		const organization = this.store.selectedOrganization;
		const organizationId = organization?.id as ID;
		const tenantId = organization?.tenantId as ID;
		const label = name.trim();
		const normalized = label.toLowerCase();

		const { items } = await this.tagsService.getTagsByLevel({ organizationId, tenantId });
		const existing = (items ?? []).find((tag) => String(tag?.name ?? '').trim().toLowerCase() === normalized);
		if (existing) return existing;

		return firstValueFrom(
			this.tagsService.create({
				name: label,
				color: this.colorForTag(normalized),
				description: '',
				organizationId,
				tenantId
			} as ITagCreateInput)
		);
	}

	/** Stable colour for a tag name — see `SUGGESTED_TAG_COLORS`. */
	private colorForTag(normalized: string): string {
		let hash = 0;
		for (let index = 0; index < normalized.length; index++) {
			hash = (hash * 31 + normalized.charCodeAt(index)) % 100003;
		}
		return SUGGESTED_TAG_COLORS[hash % SUGGESTED_TAG_COLORS.length];
	}

	// ─── Toggles ─────────────────────────────────────────────────

	async onSearchableToggle(searchable: boolean): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(
				// `searchable` is a doc-05/Wave-2 update field not yet on IDocumentUpdateInput.
				this.documentsService.update(this.document.id as ID, { searchable } as Partial<IDocument>)
			);
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	get inKnowledge(): boolean {
		const status = this.document?.knowledgeStatus;
		return (
			status === DocumentKnowledgeStatusEnum.QUEUED ||
			status === DocumentKnowledgeStatusEnum.INDEXING ||
			status === DocumentKnowledgeStatusEnum.INDEXED
		);
	}

	async onKnowledgeToggle(include: boolean): Promise<void> {
		if (!this.document) return;
		const id = this.document.id as ID;
		try {
			const document = include
				? await firstValueFrom(this.documentsService.knowledgeImport(id))
				: await firstValueFrom(this.documentsService.knowledgeExclude(id));
			this.toastrService.success(
				this.getTranslation(include ? 'DOCS.TOASTS.KNOWLEDGE_IMPORTED' : 'DOCS.TOASTS.KNOWLEDGE_EXCLUDED')
			);
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async reindex(): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(this.documentsService.reindex(this.document.id as ID));
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** FAILED indexing → re-queue via the import endpoint (FAILED → QUEUED, spec 03 §4.8). */
	async retryKnowledge(): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(this.documentsService.knowledgeImport(this.document.id as ID));
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	get knowledgeInFlight(): boolean {
		const status = this.document?.knowledgeStatus;
		return status === DocumentKnowledgeStatusEnum.QUEUED || status === DocumentKnowledgeStatusEnum.INDEXING;
	}

	async regenerateSummary(): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(this.documentsService.regenerateSummary(this.document.id as ID));
			this.applyChange(document);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	// ─── Review banner ───────────────────────────────────────────

	get showReviewBanner(): boolean {
		return this.document?.reviewStatus === DocumentReviewStatusEnum.PENDING && !this.reviewForbidden;
	}

	get isPendingReview(): boolean {
		return this.document?.reviewStatus === DocumentReviewStatusEnum.PENDING;
	}

	/**
	 * A manual review request is the ONLY way into the queue when AI is off, so
	 * it is offered for every kind — but never on a document that is already
	 * PENDING (the banner above is the state for that; the backend would no-op)
	 * nor on an archived one, which is not part of the working set.
	 */
	get canRequestReview(): boolean {
		return !!this.document && !this.isPendingReview && !this.isArchived;
	}

	/**
	 * Flags the document for a human review (`reviewReason='manual'`). The reason
	 * is optional — the dialog mirrors rejection, which is the established shape
	 * for a review note in this hub.
	 */
	async requestReview(): Promise<void> {
		if (!this.canRequestReview || !this.document) return;
		const result: { reason?: string } | null = await firstValueFrom(
			this.dialogService.open(RequestReviewDialogComponent).onClose
		);
		if (!result) return;
		try {
			const document = await firstValueFrom(
				this.documentsService.requestReview(this.document.id as ID, { reason: result.reason })
			);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.REVIEW_REQUESTED'));
			this.reviewForbidden = false; // a fresh PENDING re-arms the banner controls
			this.applyChange(document);
			// Patch the row in place and re-count the "Needs review" preset/facets —
			// the queue badge is derived from facets, not from the open panel.
			this.actions.dispatch(DocumentsActions.rowChanged(this.document as IDocument));
			this.actions.dispatch(DocumentsActions.refreshFacets());
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async approveReview(): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(this.documentsService.approveReview(this.document.id as ID));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.REVIEW_APPROVED'));
			this.applyChange(document);
		} catch (error) {
			this.handleReviewError(error);
		}
	}

	async rejectReview(reason?: string): Promise<void> {
		if (!this.document) return;
		try {
			const document = await firstValueFrom(
				this.documentsService.rejectReview(this.document.id as ID, { reason })
			);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.REVIEW_REJECTED'));
			this.applyChange(document);
		} catch (error) {
			this.handleReviewError(error);
		}
	}

	private handleReviewError(error: unknown): void {
		if ((error as { status?: number })?.status === 403) {
			this.reviewForbidden = true; // hide the banner controls on 403
		} else {
			this.toastrService.danger(error);
		}
	}

	// ─── Sharing (spec 08 §3) ────────────────────────────────────

	get isPrivate(): boolean {
		return this.document?.visibility === DocumentVisibilityEnum.PRIVATE;
	}

	/**
	 * Opens the share dialog. Offered for every document, not only PRIVATE ones:
	 * the dialog is also where visibility is flipped, so "Share" has to be the
	 * way *into* privacy, not something that only appears once you are already
	 * there.
	 */
	async openShare(): Promise<void> {
		if (!this.document) return;
		const updated: IDocument | null = await firstValueFrom(
			this.dialogService.open(DocumentShareDialogComponent, { context: { document: this.document } }).onClose
		);
		// The dialog can change visibility — reflect it on the badge row.
		if (updated) this.applyChange(updated);
	}

	// ─── Export (spec 01 §10.9 / 05 §9.1) ────────────────────────

	get isPage(): boolean {
		return this.document?.kind === DocumentKindEnum.PAGE;
	}

	async copyMarkdown(): Promise<void> {
		if (!this.document || this.exporting) return;
		this.exporting = true;
		try {
			const copied = await this.exportService.copyMarkdown(this.document);
			if (copied) this.toastrService.success(this.getTranslation('DOCS.TOASTS.MARKDOWN_COPIED'));
			else this.toastrService.warning(this.getTranslation('DOCS.EXPORT.NOTHING_TO_EXPORT'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.exporting = false;
		}
	}

	async exportMarkdown(): Promise<void> {
		if (!this.document || this.exporting) return;
		this.exporting = true;
		try {
			const written = await this.exportService.downloadMarkdown(this.document);
			if (!written) this.toastrService.warning(this.getTranslation('DOCS.EXPORT.NOTHING_TO_EXPORT'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.exporting = false;
		}
	}

	async print(): Promise<void> {
		if (!this.document || this.exporting) return;
		this.exporting = true;
		try {
			const printed = await this.exportService.print(this.document);
			if (!printed) this.toastrService.warning(this.getTranslation('DOCS.EXPORT.NOTHING_TO_EXPORT'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.exporting = false;
		}
	}

	// ─── Linked records (spec 01 §8.9) ───────────────────────────

	async addLink(): Promise<void> {
		if (!this.document) return;
		const link: IDocumentLink | null = await firstValueFrom(
			this.dialogService.open(DocumentLinkDialogComponent, {
				context: { document: this.document, existing: this.links }
			}).onClose
		);
		if (link) this.links = [...this.links, link];
	}

	async removeLink(link: IDocumentLink): Promise<void> {
		try {
			await firstValueFrom(this.documentsService.deleteLink(link.id as ID));
			this.links = this.links.filter((entry) => String(entry.id) !== String(link.id));
			this.toastrService.success(this.getTranslation('DOCS.LINKS.TOAST_REMOVED'));
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Navigates to the linked business record; no-op for entities without a detail route. */
	openLink(link: IDocumentLink): void {
		const route = findLinkEntityDescriptor(link.entity)?.route(link.entityId as ID);
		if (route) void this.router.navigateByUrl(route);
	}

	hasLinkRoute(link: IDocumentLink): boolean {
		return !!findLinkEntityDescriptor(link.entity)?.route(link.entityId as ID);
	}

	// ─── Location / people (spec 01 §8.4) ────────────────────────

	/**
	 * Resolves the ancestor chain of the open document for the "Location" row.
	 *
	 * The shared node cache answers it for free whenever the tree has been walked; a deep link
	 * straight into `?id=` has walked nothing, so it falls back to one read of the parent with
	 * its own parent — the same two-step the browse breadcrumb uses. Ancestors that cannot be
	 * resolved are NOT invented: the chain is simply shorter, and the "All documents" crumb still
	 * gets the user back out.
	 */
	private async refreshLocation(document: IDocument | null): Promise<void> {
		const parentId = document?.parentId as ID | undefined;
		if (!parentId) {
			this.location = [];
			return;
		}
		const path = this.documentTreeStore.pathOf(parentId);
		if (path.length) {
			this.location = path.map((node) => ({ id: node.id, name: node.name }));
			return;
		}
		try {
			// One level deeper than the `parent` the panel already holds: re-reading the parent
			// *with its own parent* is what buys the second crumb on a cold deep link.
			const parent = await firstValueFrom(this.documentsService.getById(parentId, ['parent']));
			this.location = this.chainOf(parent ?? document?.parent);
		} catch {
			this.location = this.chainOf(document?.parent);
		}
	}

	/** `[grandparent, parent]` — or just `[parent]`, or nothing at all. */
	private chainOf(parent?: IDocument | null): Array<{ id: ID; name: string }> {
		if (!parent) return [];
		const grandParent = parent.parent;
		return [
			...(grandParent ? [{ id: grandParent.id as ID, name: grandParent.name }] : []),
			{ id: parent.id as ID, name: parent.name }
		];
	}

	/** Drills the browse list into a folder of the Location chain (`null` = root). */
	openLocation(folderId: ID | null): void {
		this.actions.dispatch(DocumentsActions.folderChanged(folderId));
	}

	/**
	 * Display name of a user behind `createdByUser` / `updatedByUser`.
	 *
	 * Empty when the relation is absent — the row then shows the timestamp alone rather than a
	 * placeholder that reads like a real name.
	 */
	userLabel(user?: IUser | null): string {
		return (
			user?.name ||
			[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
			user?.email ||
			''
		);
	}

	// ─── Helpers ─────────────────────────────────────────────────

	/** Registered entities get their own icon; anything else falls back to a generic link. */
	linkIcon(link: IDocumentLink): string {
		return findLinkEntityDescriptor(link.entity)?.icon ?? 'link-2-outline';
	}

	/** Entity-type label (`DOCS.LINKS.ENTITY.*`), or the raw enum for unregistered types. */
	linkTypeLabel(link: IDocumentLink): string {
		const descriptor = findLinkEntityDescriptor(link.entity);
		return descriptor ? this.getTranslation(descriptor.labelKey) : String(link.entity);
	}

	/**
	 * Display label captured at link time. Falls back to the entity + id so a
	 * link created before `metadata.label` existed — or whose record was renamed
	 * away — still renders something clickable instead of a blank row.
	 */
	linkLabel(link: IDocumentLink): string {
		const metadata = link.metadata as { label?: string } | undefined;
		return metadata?.label || `${this.linkTypeLabel(link)} · ${link.entityId}`;
	}

	humanizeSize(bytes?: number): string {
		if (!bytes) return '—';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	private applyChange(document: IDocument): void {
		this.document = { ...this.document, ...document };
		this.changed.emit(this.document);
	}
}
