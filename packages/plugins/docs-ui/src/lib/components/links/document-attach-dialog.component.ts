import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
		TranslatePipe,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule
	],
	providers: [DocumentsService],
	templateUrl: './document-attach-dialog.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
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
	/** The picked documents, kept across searches so a selection survives a new term. */
	public readonly selectedIds = new Set<string>();

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

	get selectedCount(): number {
		return this.selectedIds.size;
	}

	get canConfirm(): boolean {
		return this.selectedCount > 0 && !this.saving;
	}

	isSelected(document: IDocument): boolean {
		return this.selectedIds.has(String(document.id));
	}

	toggle(document: IDocument): void {
		const id = String(document.id);
		if (this.selectedIds.has(id)) {
			this.selectedIds.delete(id);
		} else {
			this.selectedIds.add(id);
		}
	}

	/**
	 * Links every picked document to the record. Each link is its own write, so one
	 * failing does not undo the others: the dialog closes with the links that were
	 * made, and reports the ones that were not.
	 */
	async confirm(): Promise<void> {
		if (!this.canConfirm) return;
		const organization = this.store.selectedOrganization;
		const ids = [...this.selectedIds];
		this.saving = true;

		const results = await Promise.allSettled(
			ids.map((documentId) =>
				firstValueFrom(
					this.documentsService.createLink({
						documentId: documentId as ID,
						entity: this.entity,
						entityId: this.entityId,
						// Display label captured at link time (spec 02 `DocumentLink.metadata`).
						metadata: { label: this.entityLabel ?? '' },
						organizationId: organization?.id,
						tenantId: organization?.tenantId
					})
				)
			)
		);

		const links = results
			.filter((result): result is PromiseFulfilledResult<IDocumentLink> => result.status === 'fulfilled')
			.map((result) => result.value);
		const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

		if (links.length) {
			this.toastrService.success(
				links.length === 1
					? this.getTranslation('DOCS.LINKS.TOAST_ADDED')
					: this.getTranslation('DOCS.LINKS.TOAST_ADDED_MANY', { count: links.length })
			);
		}
		if (failures.length) {
			if (ids.length === 1) {
				// A single document keeps the server's own reason.
				this.toastrService.danger(failures[0].reason);
			} else {
				const names = ids
					.filter((_, index) => results[index].status === 'rejected')
					.map((id) => this.results.find((document) => String(document.id) === id)?.name ?? id);
				this.toastrService.danger(
					this.getTranslation('DOCS.LINKS.TOAST_FAILED_SOME', {
						failed: failures.length,
						total: ids.length,
						names: names.join(', ')
					})
				);
			}
		}

		if (links.length) {
			this.dialogRef.close(links);
		} else {
			// Nothing was attached: stay open so the user can retry or change the selection.
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
