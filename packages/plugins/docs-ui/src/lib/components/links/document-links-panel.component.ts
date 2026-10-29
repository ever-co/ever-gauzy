import { CommonModule } from '@angular/common';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import {
	Component,
	EventEmitter,
	Input,
	OnChanges,
	OnDestroy,
	Output,
	type SimpleChanges,
	ChangeDetectionStrategy
} from '@angular/core';
import { Router } from '@angular/router';
import {
	NbButtonModule,
	NbDialogService,
	NbIconModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { filter, firstValueFrom, map, Subject, takeUntil } from 'rxjs';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	FeatureEnum,
	ID,
	IDocument,
	IDocumentLink,
	PermissionsEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_PAGE_LINK, DOCS_UPLOAD_ACCEPT } from '../../docs.constants';
import { DocumentsService } from '../../services/documents.service';
import { DocumentAttachDialogComponent } from './document-attach-dialog.component';
import { DocumentImagePreviewDialogComponent } from './document-image-preview-dialog.component';

/** The broad family of an attached document, for its icon and tint. */
export type DocumentLinkFamily = 'page' | 'pdf' | 'image' | 'video' | 'audio' | 'sheet' | 'file';

const DOCUMENT_LINK_ICONS: Record<DocumentLinkFamily, string> = {
	page: 'file-text-outline',
	pdf: 'file-outline',
	image: 'image-outline',
	video: 'film-outline',
	audio: 'headphones-outline',
	sheet: 'grid-outline',
	file: 'attach-outline'
};

/** How the panel lays its documents out; remembered per browser. */
export type DocumentLinksView = 'list' | 'grid';

const DOCUMENT_LINKS_VIEW_KEY = 'gauzy-docs-links-view';

/**
 * The grid fetches a saved image's bytes to draw its tile; past this size it keeps the
 * family icon instead, and only the preview pulls the file.
 */
const GRID_THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The record-side **Documents** panel (`00-product-spec.md` §6.14 R-LNK-02,
 * `10-implementation-plan.md` §6.1 C6): every document attached to one business
 * record, with open / download / unlink plus "attach existing" and "upload new".
 *
 * Mounted on the invoice, task, project, employee and contact detail surfaces. It
 * is the mirror image of the hub's own **Linked records** section: that one lists
 * the records a document points at, this one lists the documents pointing at a
 * record. Both ride the same `GET /plugins/docs/links` endpoint, which already
 * projects a list-safe document (name/kind/mime/size — never content, never the
 * storage key) through the document visibility scope, so a link to a PRIVATE
 * document the caller cannot read never reaches this component at all.
 *
 * 🛑 **Standalone on purpose.** The hosts are app NgModules that must not — and
 * cannot — pull in `DocsUiModule` (it provides the hub's ROUTES factory and its
 * Akita stores). Being standalone also means it brings its own `DocumentsService`
 * provider: outside the hub there is no module-level instance to inherit.
 *
 * 🛑 It gates **itself** on `DOCS_READ` + `FEATURE_DOCUMENTS` rather than making
 * five host templates remember to. A host embeds one line and the panel decides
 * whether it exists.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-document-links-panel',
	standalone: true,
	imports: [
		CommonModule,
		TranslatePipe,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule
	],
	providers: [DocumentsService],
	templateUrl: './document-links-panel.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	styleUrls: ['./document-links-panel.component.scss']
})
export class DocumentLinksPanelComponent extends TranslationBaseComponent implements OnChanges, OnDestroy {
	/** The business-record type this panel hangs off (e.g. `BaseEntityEnum.Invoice`). */
	@Input() entity!: BaseEntityEnum;

	/** The business-record id. The panel renders nothing until this is set. */
	@Input() entityId!: ID;

	/**
	 * Optional display name of the host record, persisted into
	 * `DocumentLink.metadata.label` when a document is attached — the hub's own
	 * Linked-records section renders that label instead of a bare UUID, and it keeps
	 * showing something if the record is later renamed or removed.
	 */
	@Input() entityLabel?: string;

	/**
	 * Read-only hosting: hides the attach / upload / unlink affordances while
	 * keeping open and download. For surfaces that present the record itself as
	 * read-only (the invoice/estimate VIEW page) — mutating attachments belongs on
	 * the edit surface there. A host choice, not a permission: `canLink` /
	 * `canUpload` are untouched.
	 */
	@Input() readonly = false;

	/**
	 * When set, the whole card renders only once at least one link exists — on a
	 * read-only host an empty "Documents" card is pure noise. Off by default so
	 * the existing hosts keep offering "attach" on an empty panel.
	 */
	@Input() hideWhenEmpty = false;

	/**
	 * For a record that is not saved yet (a create page): picked and dropped files are
	 * held here and listed, and the host attaches them with {@link attachPending} once
	 * the record exists. Only uploading is offered — there is nothing to link an
	 * existing document to yet.
	 */
	@Input() deferred = false;

	/** Emits the current link count after every load/mutation (host badge counters). */
	@Output() countChanged = new EventEmitter<number>();

	public links: IDocumentLink[] = [];
	/**
	 * Files a `deferred` panel holds until the host calls {@link attachPending}, each
	 * with a document-shaped row so it is listed like an attached one.
	 */
	public pending: { file: File; row: IDocumentLink }[] = [];
	public loading = false;
	public loadError = false;
	/** Set while an upload batch is in flight — the upload targets are disabled until it ends. */
	public uploading = false;
	/** Where an upload batch has got to, for the "Uploading 2 of 5…" line; null when idle. */
	public uploadProgress: { done: number; total: number } | null = null;
	/** True while files are dragged over the panel, which then shows its drop target. */
	public dragActive = false;
	/** `dragenter`/`dragleave` fire for every child crossed; the depth tells a real leave from those. */
	private dragDepth = 0;
	/** List rows or grid tiles; the choice is the viewer's, kept in this browser. */
	public view: DocumentLinksView = readStoredView();
	/**
	 * `blob:` URLs of saved images, by document id — the grid's tiles and the preview
	 * share them, so a picture is fetched once. Revoked when the panel goes.
	 */
	private readonly imageUrls = new Map<string, string>();
	/** Document ids whose bytes were already asked for, so a reload never fetches twice. */
	private readonly requestedImages = new Set<string>();
	/** `blob:` URLs of held images, straight from the user's machine. */
	private readonly pendingUrls = new Map<File, string>();
	/** Fires when the panel goes, cancelling its image reads. */
	private readonly destroy$ = new Subject<void>();
	/** Set once the panel is gone: the thumbnail loop stops and no further URL is created. */
	private destroyed = false;

	public readonly permissions = PermissionsEnum;
	/** Accept list for the file input (UX only — the server sniffs and re-validates). */
	public readonly accept = DOCS_UPLOAD_ACCEPT;

	constructor(
		public readonly translateService: TranslateService,
		private readonly documentsService: DocumentsService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly router: Router,
		private readonly store: Store
	) {
		super(translateService);
	}

	/**
	 * Reloads on every (entity, entityId) change — the hosts reuse one component
	 * instance across records (a routed detail page navigating between ids, a dialog
	 * reopened for another row), so binding once in `ngOnInit` would leave the second
	 * record showing the first one's documents.
	 */
	ngOnChanges(changes: SimpleChanges): void {
		if (changes['entity'] || changes['entityId']) {
			void this.load();
		}
	}

	ngOnDestroy(): void {
		// Cuts the image reads in flight, so none resolves into a URL nobody would revoke.
		this.destroyed = true;
		this.destroy$.next();
		this.destroy$.complete();
		this.imageUrls.forEach((url) => URL.revokeObjectURL(url));
		this.pendingUrls.forEach((url) => URL.revokeObjectURL(url));
	}

	// ─── Visibility ──────────────────────────────────────────────

	/**
	 * The panel exists only for a reader of an org with the feature on. Both halves
	 * matter: the permission alone would render a panel whose every request 403s on a
	 * feature-disabled organization (`FeatureFlagGuard` fronts all docs routes).
	 */
	get visible(): boolean {
		const allowed =
			!!this.entity &&
			this.store.hasPermission(PermissionsEnum.DOCS_READ) &&
			this.store.hasFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS);
		// A deferred panel can only collect uploads, so without upload rights it has nothing to offer.
		return allowed && (this.isPending ? this.canUpload : !!this.entityId);
	}

	/** A `deferred` panel whose record is not saved yet: files are held, not uploaded. */
	get isPending(): boolean {
		return this.deferred && !this.entityId;
	}

	/**
	 * The template's root gate: `visible`, narrowed by `hideWhenEmpty` to "only
	 * once at least one link has actually loaded". A load in flight or a failed
	 * load keeps the card up regardless — hiding it there would hide the error
	 * state and the retry affordance with it.
	 */
	get shown(): boolean {
		return this.visible && (!this.hideWhenEmpty || this.loading || this.loadError || this.links.length > 0);
	}

	/** Attaching and detaching are both `DOCS_UPDATE` (`POST`/`DELETE /links`). */
	get canLink(): boolean {
		return this.store.hasPermission(PermissionsEnum.DOCS_UPDATE);
	}

	/**
	 * "Upload new" is two writes — the document (`DOCS_CREATE`) and then the link
	 * (`DOCS_UPDATE`). Both are required: offering it to a `DOCS_CREATE`-only holder
	 * would upload the file and then fail to attach it, leaving an orphan in the hub.
	 */
	get canUpload(): boolean {
		return this.store.hasPermission(PermissionsEnum.DOCS_CREATE) && this.canLink;
	}

	// ─── Loading ─────────────────────────────────────────────────

	async load(): Promise<void> {
		if (!this.visible || this.isPending) {
			this.links = [];
			return;
		}
		this.loading = true;
		this.loadError = false;
		try {
			this.links = await firstValueFrom(this.documentsService.findLinks(this.entity, this.entityId));
			this.countChanged.emit(this.links.length);
			if (this.view === 'grid') void this.loadThumbnails();
		} catch {
			// Fault-isolated: an attachments panel that fails must not take the host
			// record page down with it.
			this.loadError = true;
			this.links = [];
		} finally {
			this.loading = false;
		}
	}

	// ─── Row rendering ───────────────────────────────────────────

	/** Row label: the document name, falling back to the label captured at link time. */
	labelOf(link: IDocumentLink): string {
		const metadata = (link?.metadata ?? {}) as { label?: string };
		return link?.document?.name || metadata.label || String(link?.documentId ?? '');
	}

	/**
	 * The broad family of a document, from its kind, MIME type and file extension.
	 * Drives the row's icon and tint.
	 */
	familyOf(link: IDocumentLink): DocumentLinkFamily {
		const document = link?.document;
		if (document?.kind === DocumentKindEnum.PAGE) return 'page';
		const mime = (document?.mimeType ?? '').toLowerCase();
		const ext = this.extensionOf(link);
		if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
		if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
		if (mime.startsWith('video/')) return 'video';
		if (mime.startsWith('audio/')) return 'audio';
		if (mime.includes('spreadsheet') || mime.includes('excel') || ['xlsx', 'xls', 'ods', 'csv'].includes(ext)) {
			return 'sheet';
		}
		return 'file';
	}

	/** Eva icon per family — a picture, a PDF and a page read very differently in a list. */
	iconOf(link: IDocumentLink): string {
		return DOCUMENT_LINK_ICONS[this.familyOf(link)];
	}

	/** Short type label for the row's meta line: the extension (`PNG`), or `Page` for a page. */
	typeOf(link: IDocumentLink): string {
		if (this.familyOf(link) === 'page') return '';
		const ext = this.extensionOf(link);
		return ext && ext.length <= 5 ? ext.toUpperCase() : '';
	}

	private extensionOf(link: IDocumentLink): string {
		const document = link?.document;
		const name = document?.originalFilename || document?.name || '';
		return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
	}

	/** `123 KB`, or an empty string when there are no bytes (a PAGE has none). */
	sizeOf(link: IDocumentLink): string {
		const bytes = link?.document?.fileSize;
		if (!bytes || bytes <= 0) return '';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	/** Only a FILE has bytes to download; a PAGE's "download" is an export, not this. */
	isFile(link: IDocumentLink): boolean {
		return link?.document?.kind === DocumentKindEnum.FILE;
	}

	/** A picture the popup can show: a saved image file, or a held one. */
	isImage(link: IDocumentLink): boolean {
		return this.familyOf(link) === 'image' && this.isFile(link);
	}

	/** A saved image's tile picture, once fetched; the tile shows its family icon until then. */
	thumbOf(link: IDocumentLink): string | null {
		const documentId = link?.documentId ?? link?.document?.id;
		return documentId ? this.imageUrls.get(String(documentId)) ?? null : null;
	}

	/** A held image's tile picture, read from the user's machine. */
	pendingThumbOf(file: File): string | null {
		return this.pendingUrls.get(file) ?? null;
	}

	trackByLink(_: number, link: IDocumentLink): string {
		return String(link?.id ?? link?.documentId);
	}

	// ─── View ────────────────────────────────────────────────────

	/** Switches between list rows and grid tiles, and remembers the choice in this browser. */
	toggleView(): void {
		this.view = this.view === 'grid' ? 'list' : 'grid';
		try {
			localStorage.setItem(DOCUMENT_LINKS_VIEW_KEY, this.view);
		} catch {
			// Storage blocked (a private window): the choice lasts for this visit only.
		}
		if (this.view === 'grid') void this.loadThumbnails();
	}

	/**
	 * Fetches the saved images the grid draws, one at a time. A picture that fails, or is
	 * too large to fetch for a tile, keeps its family icon.
	 */
	private async loadThumbnails(): Promise<void> {
		for (const link of this.links) {
			if (this.destroyed) return;
			const documentId = String(link?.documentId ?? link?.document?.id ?? '');
			if (!documentId || !this.isImage(link) || this.requestedImages.has(documentId)) continue;
			if ((link.document?.fileSize ?? 0) > GRID_THUMBNAIL_MAX_BYTES) continue;
			this.requestedImages.add(documentId);
			try {
				await this.imageUrlOf(documentId);
			} catch {
				// The tile keeps its icon.
			}
		}
	}

	/**
	 * A saved image's `blob:` URL, fetched through the authenticated client on first use.
	 * Rejects once the panel is gone: the read is cancelled and no URL is created.
	 */
	private async imageUrlOf(documentId: string): Promise<string> {
		const cached = this.imageUrls.get(documentId);
		if (cached) return cached;
		const blob = await firstValueFrom(
			this.documentsService.getRawBlob(documentId as ID).pipe(takeUntil(this.destroy$))
		);
		if (this.destroyed) throw new Error('The Documents panel was closed');
		const url = URL.createObjectURL(blob);
		this.imageUrls.set(documentId, url);
		return url;
	}

	// ─── Actions ─────────────────────────────────────────────────

	/** Opens a saved image in the popup. */
	previewLink(link: IDocumentLink): void {
		const documentId = link?.documentId ?? link?.document?.id;
		if (!documentId) return;
		this.openImagePreview(this.labelOf(link), () => this.imageUrlOf(String(documentId)));
	}

	private openImagePreview(name: string, resolveSrc: () => Promise<string | null>): void {
		this.dialogService.open(DocumentImagePreviewDialogComponent, { context: { name, resolveSrc } });
	}

	/**
	 * Opens the document in the hub: a PAGE goes straight to its editor route, a FILE
	 * (or anything else) deep-links the browse surface with `?id=`, which is what
	 * opens the detail panel — `docs-shell.component.ts` treats that query param as
	 * the source of truth for the open panel.
	 */
	open(link: IDocumentLink): void {
		const documentId = link?.documentId ?? link?.document?.id;
		if (!documentId) return;
		if (link?.document?.kind === DocumentKindEnum.PAGE) {
			void this.router.navigate([`${DOCS_PAGE_LINK}/page`, documentId]);
			return;
		}
		void this.router.navigate([DOCS_PAGE_LINK], { queryParams: { id: documentId } });
	}

	/**
	 * Downloads the original bytes.
	 *
	 * 🛑 `GET /:id/download` answers `{ url }` **as JSON behind the JWT guard** — it
	 * is not a redirect. It has to be fetched through the authenticated client and
	 * only the resolved provider URL may be handed to the browser; navigating to the
	 * endpoint directly sends no token and lands on a 401.
	 */
	async download(link: IDocumentLink): Promise<void> {
		const documentId = link?.documentId ?? link?.document?.id;
		if (!documentId) return;
		try {
			const url = await firstValueFrom(this.documentsService.getDownloadUrl(documentId as ID));
			if (url) {
				window.open(url, '_blank', 'noopener');
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Detaches the document from this record. The document itself is untouched. */
	async unlink(link: IDocumentLink): Promise<void> {
		if (!link?.id) return;
		try {
			await firstValueFrom(this.documentsService.deleteLink(link.id as ID));
			this.links = this.links.filter((row) => String(row.id) !== String(link.id));
			this.releaseImage(String(link.documentId ?? link.document?.id ?? ''));
			this.countChanged.emit(this.links.length);
			this.toastrService.success(this.getTranslation('DOCS.LINKS.TOAST_REMOVED'));
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Frees a saved image's `blob:` URL once nothing on the panel shows it. */
	private releaseImage(documentId: string): void {
		const url = this.imageUrls.get(documentId);
		if (!url) return;
		URL.revokeObjectURL(url);
		this.imageUrls.delete(documentId);
		this.requestedImages.delete(documentId);
	}

	/** Picks one or more existing documents and attaches them to this record. */
	async attachExisting(): Promise<void> {
		const attached: IDocumentLink[] | null = await firstValueFrom(
			this.dialogService.open(DocumentAttachDialogComponent, {
				context: {
					entity: this.entity,
					entityId: this.entityId,
					entityLabel: this.entityLabel,
					existing: this.links
				}
			}).onClose
		);
		if (!attached?.length) return;
		// Re-read rather than pushing the dialog's rows: `POST /links` answers with the
		// bare link, no `document` relation, and a row without it renders as an id.
		await this.load();
	}

	/** The file being uploaded now, counted from 1 — "Uploading 2 of 5". */
	get uploadStep(): number {
		const progress = this.uploadProgress;
		return progress ? Math.min(progress.done + 1, progress.total) : 0;
	}

	/** The file picker's `change`: every picked file is uploaded and attached. */
	async uploadNew(input: HTMLInputElement): Promise<void> {
		const files = Array.from(input?.files ?? []);
		// Cleared immediately so picking the same files again still fires `change`.
		if (input) input.value = '';
		await this.uploadFiles(files);
	}

	/**
	 * Uploads files and links each to this record, one after another — a batch of
	 * large files in parallel would compete for the same connection and finish no
	 * sooner. One file failing does not stop the rest; the batch ends with a single
	 * summary instead of a toast per file.
	 *
	 * @returns The files that were not attached — none when a pending panel only held them.
	 */
	async uploadFiles(files: File[]): Promise<File[]> {
		if (!files.length) return [];
		// A batch already in flight owns the panel: nothing of this one was attached.
		if (this.uploading) return files;
		if (this.isPending) {
			this.holdFiles(files);
			return [];
		}

		const organization = this.store.selectedOrganization;
		const total = files.length;
		const failed: File[] = [];
		let lastError: unknown = null;

		this.uploading = true;
		this.uploadProgress = { done: 0, total };
		try {
			for (const file of files) {
				try {
					await this.uploadAndLink(file, organization);
				} catch (error) {
					failed.push(file);
					lastError = error;
				}
				this.uploadProgress = { done: this.uploadProgress.done + 1, total };
			}

			const attached = total - failed.length;
			if (attached > 0) {
				this.toastrService.success(
					attached === 1
						? this.getTranslation('DOCS.LINKS.TOAST_ADDED')
						: this.getTranslation('DOCS.LINKS.TOAST_ADDED_MANY', { count: attached })
				);
				await this.load();
			}
			if (failed.length) {
				// A single file keeps the server's own reason (type rejected, too large…).
				this.toastrService.danger(
					total === 1
						? lastError
						: this.getTranslation('DOCS.LINKS.TOAST_FAILED_SOME', {
								failed: failed.length,
								total,
								names: failed.map(({ name }) => name).join(', ')
						  })
				);
			}
			return failed;
		} finally {
			this.uploading = false;
			this.uploadProgress = null;
		}
	}

	// ─── Deferred: files held until the record exists ────────────

	/** Holds files for later; picking the same file twice keeps one copy. */
	private holdFiles(files: File[]): void {
		const keyOf = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;
		const held = new Set(this.pending.map(({ file }) => keyOf(file)));
		for (const file of files) {
			if (held.has(keyOf(file))) continue;
			held.add(keyOf(file));
			if (file.type.startsWith('image/')) this.pendingUrls.set(file, URL.createObjectURL(file));
			this.pending = [
				...this.pending,
				{
					file,
					row: {
						document: {
							name: file.name,
							originalFilename: file.name,
							mimeType: file.type,
							fileSize: file.size,
							kind: DocumentKindEnum.FILE
						}
					} as IDocumentLink
				}
			];
		}
		this.countChanged.emit(this.pending.length);
	}

	/** A held file the eye button can show: an image in the popup, or a PDF in the browser's viewer. */
	canPreviewPending(file: File): boolean {
		return this.pendingUrls.has(file) || isPdf(file);
	}

	/**
	 * Shows a held file from the user's own machine — nothing is uploaded. An image opens
	 * in the popup and a PDF in a new tab; anything else is downloaded under its own name.
	 *
	 * 🛑 Never open any other held file as a page: a `blob:` document shares the app's
	 * origin, so a picked HTML file's scripts could read the session tokens in
	 * `localStorage`, and `noopener` does not sandbox it.
	 */
	previewPending(file: File): void {
		const imageUrl = this.pendingUrls.get(file);
		if (imageUrl) {
			this.openImagePreview(file.name, async () => imageUrl);
			return;
		}
		// A PDF's bytes are typed as a PDF whatever the file claims, so a renamed page can never render as HTML.
		const url = URL.createObjectURL(isPdf(file) ? new Blob([file], { type: 'application/pdf' }) : file);
		if (isPdf(file)) {
			window.open(url, '_blank', 'noopener');
		} else {
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = file.name;
			anchor.click();
		}
		// Released once the tab or the download has had time to read it.
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}

	/** Drops a held file before it is ever uploaded. */
	removePending(file: File): void {
		this.pending = this.pending.filter((item) => item.file !== file);
		this.releasePending(file);
		this.countChanged.emit(this.pending.length);
	}

	private releasePending(file: File): void {
		const url = this.pendingUrls.get(file);
		if (!url) return;
		URL.revokeObjectURL(url);
		this.pendingUrls.delete(file);
	}

	/**
	 * Uploads the held files and attaches them to the record the host just saved. The
	 * usual summary toasts report the outcome; a file that fails does not undo the save.
	 * Failed files stay listed, so calling this again retries only them.
	 *
	 * @param entityId The saved record's id.
	 * @param entityLabel Its display name, stored on each link.
	 * @returns `true` once every held file is attached — a host should not leave the page otherwise.
	 */
	async attachPending(entityId: ID, entityLabel?: string): Promise<boolean> {
		if (!entityId) return false;
		this.entityId = entityId;
		if (entityLabel) this.entityLabel = entityLabel;
		const files = this.pending.map(({ file }) => file);
		const failed = new Set(await this.uploadFiles(files));
		files.filter((file) => !failed.has(file)).forEach((file) => this.releasePending(file));
		this.pending = this.pending.filter(({ file }) => failed.has(file));
		if (failed.size) this.countChanged.emit(this.links.length + this.pending.length);
		return failed.size === 0;
	}

	trackByPending(_: number, item: { file: File }): string {
		return `${item.file.name}|${item.file.size}|${item.file.lastModified}`;
	}

	/**
	 * Uploads one file and links it to this record.
	 *
	 * Deliberately two calls, not one: the upload endpoint knows nothing about
	 * `DocumentLink`, so the link is created from the accepted document. A failed link
	 * write is surfaced but the document is kept — deleting a file the user just
	 * uploaded because a follow-up call failed would be the worse outcome.
	 */
	private async uploadAndLink(file: File, organization: { id?: ID; tenantId?: ID } | undefined): Promise<void> {
		// 🛑 `upload()` is a progress stream: the FIRST emission is the `Sent`
		// event, not the result. Only the `Response` event carries the document.
		const document = await firstValueFrom(
			this.documentsService
				.upload(file, { organizationId: organization?.id, tenantId: organization?.tenantId })
				.pipe(
					filter((event): event is HttpResponse<IDocument> => event.type === HttpEventType.Response),
					map((event) => event.body)
				)
		);
		if (!document?.id) {
			throw new Error(this.getTranslation('DOCS.LINKS.TOAST_FAILED_SOME', { failed: 1, total: 1, names: file.name }));
		}

		await firstValueFrom(
			this.documentsService.createLink({
				documentId: document.id as ID,
				entity: this.entity,
				entityId: this.entityId,
				metadata: { label: this.entityLabel ?? '' },
				organizationId: organization?.id,
				tenantId: organization?.tenantId
			})
		);
	}

	// ─── Drag and drop ───────────────────────────────────────────

	/**
	 * Only a drag that carries files, onto a panel that may upload and is not already
	 * uploading, is a drop target. During a batch the upload buttons are disabled, and
	 * `uploadFiles` would drop the files without a word — so the browser refuses the drop.
	 */
	private acceptsDrop(event: DragEvent): boolean {
		return !this.readonly && this.canUpload && !this.uploading && !!event.dataTransfer?.types?.includes('Files');
	}

	onDragEnter(event: DragEvent): void {
		if (!this.acceptsDrop(event)) return;
		event.preventDefault();
		this.dragDepth++;
		this.dragActive = true;
	}

	onDragOver(event: DragEvent): void {
		if (!this.acceptsDrop(event)) return;
		// Without this the browser refuses the drop and opens the file instead.
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	onDragLeave(event: DragEvent): void {
		if (!this.acceptsDrop(event)) return;
		this.dragDepth = Math.max(0, this.dragDepth - 1);
		if (this.dragDepth === 0) this.dragActive = false;
	}

	onDrop(event: DragEvent): void {
		if (!this.acceptsDrop(event)) return;
		event.preventDefault();
		this.dragDepth = 0;
		this.dragActive = false;
		void this.uploadFiles(Array.from(event.dataTransfer?.files ?? []));
	}
}

/** A PDF, by type or extension — the one non-image held file safe to open in a tab. */
function isPdf(file: File): boolean {
	return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** The view this browser last chose; the list when none was kept or storage is blocked. */
function readStoredView(): DocumentLinksView {
	try {
		return localStorage.getItem(DOCUMENT_LINKS_VIEW_KEY) === 'grid' ? 'grid' : 'list';
	} catch {
		return 'list';
	}
}
