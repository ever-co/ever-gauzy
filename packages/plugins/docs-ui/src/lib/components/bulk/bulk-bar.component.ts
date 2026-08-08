import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_BULK_MAX_IDS, DOCS_BULK_MAX_INLINE_ERRORS } from '../../docs.constants';
import { DocumentBulkAction, IDocumentBulkResult, IDocumentBulkResultItem } from '../../models/docs-api.model';

/** Actions after which a row may no longer belong to the current scope. */
const DOCS_DESTRUCTIVE_BULK_ACTIONS: DocumentBulkAction[] = [
	'ARCHIVE',
	'UNARCHIVE',
	'DELETE',
	'MOVE',
	'REVIEW_APPROVE',
	'REVIEW_REJECT'
];
import { MoveDialogComponent } from '../../dialogs/move-dialog.component';
import { RejectDialogComponent } from '../../dialogs/reject-dialog.component';
import { DocumentsService } from '../../services/documents.service';

/**
 * Sticky bulk bar shown while the selection is non-empty. Actions map 1:1 to
 * `POST /documents/bulk` (≤ 200 ids). The result toast summarizes
 * succeeded/failed; the expandable panel lists up to 10 per-id errors with a
 * "Copy full report" action for the complete list.
 */
@Component({
	selector: 'gz-docs-bulk-bar',
	templateUrl: './bulk-bar.component.html',
	styleUrls: ['./bulk-bar.component.scss'],
	standalone: false
})
export class BulkBarComponent extends TranslationBaseComponent {
	@Input() selectedIds: ID[] = [];
	/** Review-queue mode: only approve/reject (DOCS_REVIEW). */
	@Input() reviewMode = false;

	@Output() completed = new EventEmitter<{ destructive: boolean }>();
	@Output() cleared = new EventEmitter<void>();

	public busy = false;
	public errors: IDocumentBulkResultItem[] = [];
	public errorsExpanded = false;
	public tagsInput = '';

	public readonly permissions = PermissionsEnum;
	public readonly maxIds = DOCS_BULK_MAX_IDS;
	public readonly maxInlineErrors = DOCS_BULK_MAX_INLINE_ERRORS;

	constructor(
		public readonly translateService: TranslateService,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
	}

	get count(): number {
		return this.selectedIds?.length ?? 0;
	}

	get overLimit(): boolean {
		return this.count > this.maxIds;
	}

	get inlineErrors(): IDocumentBulkResultItem[] {
		return this.errors.slice(0, this.maxInlineErrors);
	}

	clear(): void {
		this.errors = [];
		this.cleared.emit();
	}

	async run(action: DocumentBulkAction, extra: Partial<Parameters<DocumentsService['bulk']>[0]> = {}): Promise<void> {
		if (this.busy || !this.count || this.overLimit) return;
		this.busy = true;
		this.errors = [];
		try {
			const result: IDocumentBulkResult = await firstValueFrom(
				this.documentsService.bulk({ action, ids: this.selectedIds.slice(0, this.maxIds), ...extra })
			);
			this.toastrService.success(
				this.getTranslation('DOCS.BULK.RESULT_TOAST', {
					succeeded: result?.succeeded ?? 0,
					failed: result?.failed ?? 0
				}),
				this.getTranslation('DOCS.BULK.RESULT_SUMMARY')
			);
			this.errors = (result?.results ?? []).filter((item) => !item.ok);
			// Destructive = the row can leave the current scope, so the selection is
			// dropped and the list reloaded.
			const destructive = DOCS_DESTRUCTIVE_BULK_ACTIONS.includes(action);
			this.completed.emit({ destructive });
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.busy = false;
		}
	}

	/** Bulk reject: optional reason via the shared reject dialog (same `reason` field as single). */
	async reject(): Promise<void> {
		const result: { reason?: string } | null = await firstValueFrom(
			this.dialogService.open(RejectDialogComponent).onClose
		);
		if (!result) return;
		await this.run('REVIEW_REJECT', { reason: result.reason });
	}

	async move(): Promise<void> {
		const moved = await firstValueFrom(
			this.dialogService.open(MoveDialogComponent, { context: { documentIds: this.selectedIds } }).onClose
		);
		if (moved) this.completed.emit({ destructive: true });
	}

	addTags(): void {
		const tags = this.parseTags();
		if (tags.length) void this.run('ADD_TAGS', { tagIds: tags });
	}

	removeTags(): void {
		const tags = this.parseTags();
		if (tags.length) void this.run('REMOVE_TAGS', { tagIds: tags });
	}

	async copyReport(): Promise<void> {
		const report = this.errors.map((item) => `${item.id}: ${item.code ?? 'failed'}`).join('\n');
		try {
			await navigator.clipboard.writeText(report);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.LINK_COPIED'));
		} catch {
			// clipboard unavailable — ignore
		}
	}

	private parseTags(): string[] {
		return this.tagsInput
			.split(',')
			.map((value) => value.trim())
			.filter((value) => !!value);
	}
}
