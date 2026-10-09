import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject, catchError, debounceTime, distinctUntilChanged, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { BaseEntityEnum, DocumentKindEnum, ID, IDocument, IDocumentLink } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_SEARCH_DEBOUNCE_MS } from '../../docs.constants';
import { DocumentsService } from '../../services/documents.service';

/** One page of picker results — enough to scan, small enough not to need paging. */
const DOCUMENT_PICKER_PAGE_SIZE = 20;

/**
 * "Attach existing…" flow of the record-side Documents panel: search the hub by
 * name, pick one document, create the `DocumentLink` against the host record.
 *
 * The inverse of `dialogs/link-dialog.component.ts` (which starts from a document
 * and picks a record). Kept separate rather than parameterizing that one: it is a
 * different search surface — one endpoint instead of six entity services — and it
 * has to be **standalone**, because it is opened from the standalone panel mounted
 * on app pages where `DocsUiModule`'s declarations are not in scope.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-document-attach-dialog',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule
	],
	providers: [DocumentsService],
	templateUrl: './document-attach-dialog.component.html',
	styleUrls: ['./document-attach-dialog.component.scss']
})
export class DocumentAttachDialogComponent extends TranslationBaseComponent implements OnInit {
	/** Host record type. Required. */
	@Input() entity!: BaseEntityEnum;
	/** Host record id. Required. */
	@Input() entityId!: ID;
	/** Host record display name, persisted into `DocumentLink.metadata.label`. */
	@Input() entityLabel?: string;
	/** Links that already exist on the record — their documents are filtered out. */
	@Input() existing: IDocumentLink[] = [];

	public search = '';
	public results: IDocument[] = [];
	public selectedId: ID | null = null;

	public loading = false;
	public saving = false;

	private readonly search$ = new Subject<string>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<DocumentAttachDialogComponent>,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.search$
			.pipe(
				debounceTime(DOCS_SEARCH_DEBOUNCE_MS),
				distinctUntilChanged(),
				tap(() => (this.loading = true)),
				switchMap((term) =>
					this.documentsService
						.getAll({
							q: term || undefined,
							searchIn: 'name',
							archived: false,
							sort: 'updatedAt',
							sortOrder: 'DESC',
							take: DOCUMENT_PICKER_PAGE_SIZE
						})
						// A failed search yields an empty picker, never a broken dialog.
						.pipe(catchError(() => of({ items: [], total: 0 })))
				),
				tap((page) => {
					// 🛑 `GetDocumentsQueryDTO.kind` is a scalar, so "pages and files but
					// not folders" cannot be expressed on the wire — folders are dropped
					// here instead. Attaching a folder is not what this panel means.
					this.results = (page?.items ?? []).filter((row) => row.kind !== DocumentKindEnum.FOLDER);
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Cold start: the most recently updated documents, before anything is typed.
		this.search$.next('');
	}

	onSearchChange(term: string): void {
		this.search = term;
		this.search$.next(term.trim());
	}

	/** Already-attached documents are hidden — the link write is idempotent anyway. */
	get filtered(): IDocument[] {
		const linked = new Set((this.existing ?? []).map((link) => String(link.documentId)));
		return this.results.filter((document) => !linked.has(String(document.id)));
	}

	get canConfirm(): boolean {
		return !!this.selectedId && !this.saving;
	}

	async confirm(): Promise<void> {
		if (!this.canConfirm) return;
		const organization = this.store.selectedOrganization;
		this.saving = true;
		try {
			const link = await firstValueFrom(
				this.documentsService.createLink({
					documentId: this.selectedId as ID,
					entity: this.entity,
					entityId: this.entityId,
					// Display label captured at link time (spec 02 `DocumentLink.metadata`).
					metadata: { label: this.entityLabel ?? '' },
					organizationId: organization?.id,
					tenantId: organization?.tenantId
				})
			);
			this.toastrService.success(this.getTranslation('DOCS.LINKS.TOAST_ADDED'));
			this.dialogRef.close(link);
		} catch (error) {
			this.toastrService.danger(error);
			this.saving = false;
		}
	}

	cancel(): void {
		this.dialogRef.close(null);
	}

	iconOf(document: IDocument): string {
		return document?.kind === DocumentKindEnum.PAGE ? 'file-text-outline' : 'attach-outline';
	}

	trackByDocument(_: number, document: IDocument): string {
		return String(document.id);
	}
}
