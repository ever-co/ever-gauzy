import { CommonModule } from '@angular/common';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { filter, firstValueFrom, map } from 'rxjs';
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
		TranslateModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule
	],
	providers: [DocumentsService],
	templateUrl: './document-links-panel.component.html',
	styleUrls: ['./document-links-panel.component.scss']
})
export class DocumentLinksPanelComponent extends TranslationBaseComponent implements OnChanges {
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

	/** Emits the current link count after every load/mutation (host badge counters). */
	@Output() countChanged = new EventEmitter<number>();

	public links: IDocumentLink[] = [];
	public loading = false;
	public loadError = false;
	/** Set while an upload is in flight — the button spins instead of queueing a second file. */
	public uploading = false;

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

	// ─── Visibility ──────────────────────────────────────────────

	/**
	 * The panel exists only for a reader of an org with the feature on. Both halves
	 * matter: the permission alone would render a panel whose every request 403s on a
	 * feature-disabled organization (`FeatureFlagGuard` fronts all docs routes).
	 */
	get visible(): boolean {
		return (
			!!this.entity &&
			!!this.entityId &&
			this.store.hasPermission(PermissionsEnum.DOCS_READ) &&
			this.store.hasFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS)
		);
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
		if (!this.visible) {
			this.links = [];
			return;
		}
		this.loading = true;
		this.loadError = false;
		try {
			this.links = await firstValueFrom(this.documentsService.findLinks(this.entity, this.entityId));
			this.countChanged.emit(this.links.length);
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

	/** Eva icon per document kind — pages and files read very differently in a list. */
	iconOf(link: IDocumentLink): string {
		return link?.document?.kind === DocumentKindEnum.PAGE ? 'file-text-outline' : 'attach-outline';
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

	trackByLink(_: number, link: IDocumentLink): string {
		return String(link?.id ?? link?.documentId);
	}

	// ─── Actions ─────────────────────────────────────────────────

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
			this.countChanged.emit(this.links.length);
			this.toastrService.success(this.getTranslation('DOCS.LINKS.TOAST_REMOVED'));
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Picks an existing document and attaches it to this record. */
	async attachExisting(): Promise<void> {
		const attached: IDocumentLink | null = await firstValueFrom(
			this.dialogService.open(DocumentAttachDialogComponent, {
				context: {
					entity: this.entity,
					entityId: this.entityId,
					entityLabel: this.entityLabel,
					existing: this.links
				}
			}).onClose
		);
		if (!attached) return;
		// Re-read rather than pushing the dialog's row: `POST /links` answers with the
		// bare link, no `document` relation, and a row without it renders as an id.
		await this.load();
	}

	/**
	 * Uploads a file and links it in one gesture.
	 *
	 * Deliberately two calls, not one: the upload endpoint knows nothing about
	 * `DocumentLink`, so the link is created from the accepted document. A failed link
	 * write is surfaced but the document is kept — deleting a file the user just
	 * uploaded because a follow-up call failed would be the worse outcome.
	 */
	async uploadNew(input: HTMLInputElement): Promise<void> {
		const file = input?.files?.[0];
		// Cleared immediately so picking the same file twice still fires `change`.
		if (input) input.value = '';
		if (!file || this.uploading) return;

		const organization = this.store.selectedOrganization;
		this.uploading = true;
		try {
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
			if (!document?.id) return;

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
			this.toastrService.success(this.getTranslation('DOCS.LINKS.TOAST_ADDED'));
			await this.load();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.uploading = false;
		}
	}
}
