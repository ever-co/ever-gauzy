import { Component, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Actions } from '@ngneat/effects-ng';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import {
	DocumentKindEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	ID,
	IDocument,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DocumentsActions } from '../../+state/documents.actions';
import { DOCS_PREVIEW_DIALOG_CONFIG } from '../../docs.constants';
import { DocsPreviewModalComponent } from '../../components/preview/docs-preview-modal.component';
import { RejectDialogComponent } from '../../dialogs/reject-dialog.component';
import { DocumentsService } from '../../services/documents.service';

/**
 * Review queue (`01-ux-spec.md` §11): PENDING documents with reason badges,
 * single approve/reject (reject with an optional reason), row selection and
 * bulk approve/reject through the bulk bar (`DOCS_REVIEW` only — the route is
 * additionally permission-guarded), plus per-row Details and Preview.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-review-page',
	templateUrl: './review-page.component.html',
	styleUrls: ['./review-page.component.scss'],
	standalone: false
})
export class ReviewPageComponent extends TranslationBaseComponent implements OnInit {
	public rows$ = new BehaviorSubject<IDocument[]>([]);
	public loading = false;
	public error = false;
	public selectedIds: ID[] = [];

	public readonly permissions = PermissionsEnum;
	public readonly kindEnum = DocumentKindEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly actions: Actions,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap(() => void this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async load(): Promise<void> {
		this.loading = true;
		this.error = false;
		try {
			const organization = this.store.selectedOrganization;
			const { items } = await firstValueFrom(
				this.documentsService.getAll({
					reviewStatus: [DocumentReviewStatusEnum.PENDING],
					archived: false,
					organizationId: organization?.id,
					tenantId: organization?.tenantId,
					relations: ['categories', 'tags'],
					sort: 'updatedAt:desc',
					take: 100
				})
			);
			const rows = items ?? [];
			this.rows$.next(rows);
			// Drop selections that left the queue.
			const present = new Set(rows.map((row) => String(row.id)));
			this.selectedIds = this.selectedIds.filter((id) => present.has(String(id)));
		} catch {
			this.error = true;
			this.rows$.next([]);
		} finally {
			this.loading = false;
		}
	}

	// ─── Selection ───────────────────────────────────────────────

	isSelected(row: IDocument): boolean {
		return this.selectedIds.some((id) => String(id) === String(row.id));
	}

	toggleSelected(row: IDocument, checked: boolean): void {
		const id = row.id as ID;
		this.selectedIds = checked
			? [...this.selectedIds.filter((selected) => String(selected) !== String(id)), id]
			: this.selectedIds.filter((selected) => String(selected) !== String(id));
	}

	get allSelected(): boolean {
		const rows = this.rows$.value;
		return rows.length > 0 && rows.every((row) => this.isSelected(row));
	}

	toggleSelectAll(checked: boolean): void {
		this.selectedIds = checked ? this.rows$.value.map((row) => row.id as ID) : [];
	}

	onClearSelection(): void {
		this.selectedIds = [];
	}

	// ─── Row actions ─────────────────────────────────────────────

	async approve(document: IDocument): Promise<void> {
		try {
			await firstValueFrom(this.documentsService.approveReview(document.id as ID));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.REVIEW_APPROVED'));
			await this.load();
			this.actions.dispatch(DocumentsActions.refreshFacets());
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Reject with an OPTIONAL reason (same `reason` field as bulk rejection). */
	async reject(document: IDocument): Promise<void> {
		const result: { reason?: string } | null = await firstValueFrom(
			this.dialogService.open(RejectDialogComponent).onClose
		);
		if (!result) return;
		try {
			await firstValueFrom(this.documentsService.rejectReview(document.id as ID, { reason: result.reason }));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.REVIEW_REJECTED'));
			await this.load();
			this.actions.dispatch(DocumentsActions.refreshFacets());
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Opens the detail side panel (`?id=` on the review URL — the shell hosts it). */
	openDetails(document: IDocument): void {
		this.actions.dispatch(DocumentsActions.detailOpened(document.id as ID));
	}

	openPreview(document: IDocument): void {
		this.dialogService.open(DocsPreviewModalComponent, { ...DOCS_PREVIEW_DIALOG_CONFIG, context: { document } });
	}

	onBulkCompleted(): void {
		this.selectedIds = [];
		void this.load();
		this.actions.dispatch(DocumentsActions.refreshFacets());
	}

	reasonKey(document: IDocument): string {
		const reason = (document.reviewReason ?? 'manual').toUpperCase().split('-').join('_');
		return `DOCS.REVIEW.REASONS.${reason}`;
	}

	reasonStatus(document: IDocument): string {
		switch (document.reviewReason) {
			case DocumentReviewReasonEnum.EXTRACTION_FAILED:
				return 'danger';
			case DocumentReviewReasonEnum.LOW_CONFIDENCE:
				return 'warning';
			case DocumentReviewReasonEnum.AI_GENERATED:
				return 'info';
			default:
				return 'basic';
		}
	}

	confidencePercent(document: IDocument): string {
		return document.aiConfidence !== undefined && document.aiConfidence !== null
			? `${Math.round(document.aiConfidence * 100)}%`
			: '';
	}

	trackById(_: number, row: IDocument): string {
		return String(row.id);
	}
}
