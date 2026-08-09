import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_ACTIVITY_MAX_ITEMS, DocumentActivityService } from '../../services/document-activity.service';
import {
	IDocumentActivityChange,
	IDocumentActivityEntry,
	mergeActivityEntries,
	toDocumentActivityEntry
} from './docs-activity.model';

/**
 * Activity timeline of the detail panel (`00-product-spec.md` §6.12 R-COL-03,
 * `01-ux-spec.md` §8.11, `04-frontend-plugin.md` §4.6).
 *
 * Reads back the rows `DocumentActivityLogSubscriber` writes on the backend event-bus seam:
 * newest first, "Show more" paging, capped at {@link DOCS_ACTIVITY_MAX_ITEMS}. System-driven
 * transitions (the whole extraction/classification/embedding pipeline marks itself
 * `actor: 'system'`) are attributed to "System" rather than to whoever happened to upload the
 * file.
 *
 * **Fault-isolated on purpose.** The panel loads links, comments and activity independently;
 * a failing activity read renders an inline retry here and leaves the rest of the panel intact.
 *
 * **Unknown values are never invented.** An action outside `ActionTypeEnum`, a column outside
 * the field-label map and an enum member with no translation all fall back to the raw stored
 * text — `custom-handler.ts` returns a missing key verbatim, so translating blindly would print
 * `DOCS.STATUS.<unmapped value>` at the user.
 */
@Component({
	selector: 'gz-docs-detail-activity',
	templateUrl: './docs-detail-activity.component.html',
	styleUrls: ['./docs-detail-activity.component.scss'],
	providers: [DocumentActivityService],
	standalone: false
})
export class DocsDetailActivityComponent extends TranslationBaseComponent implements OnChanges {
	@Input() documentId: ID;

	public entries: IDocumentActivityEntry[] = [];
	public loading = false;
	public loadError = false;
	/** Full match count reported by the API — decides whether "Show more" is offered. */
	public total = 0;

	/** 1-based page number; the DTO `skip` is a page, not an offset. */
	private page = 1;

	constructor(
		public readonly translateService: TranslateService,
		private readonly activityService: DocumentActivityService
	) {
		super(translateService);
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['documentId'] && this.documentId) {
			void this.reload();
		}
	}

	// ─── Loading ─────────────────────────────────────────────────

	/** Re-reads the first page, dropping anything already loaded. */
	async reload(): Promise<void> {
		this.page = 1;
		this.entries = [];
		this.total = 0;
		await this.load();
	}

	/** Appends the next page; no-op once the cap or the end of the log is reached. */
	async showMore(): Promise<void> {
		if (!this.canShowMore || this.loading) return;
		this.page += 1;
		await this.load();
	}

	/**
	 * True while there are more rows to fetch AND the cap leaves room for them.
	 *
	 * Both halves matter: `total` is the whole log for this document, which can be far larger
	 * than the 100-row window the panel is specified to show.
	 */
	get canShowMore(): boolean {
		return !this.loadError && this.entries.length < Math.min(this.total, DOCS_ACTIVITY_MAX_ITEMS);
	}

	private async load(): Promise<void> {
		if (!this.documentId) return;
		this.loading = true;
		this.loadError = false;
		try {
			const page = await firstValueFrom(this.activityService.getPage(this.documentId, this.page));
			const rows = (page?.items ?? []).map(toDocumentActivityEntry);
			// The page window can shift under us when a row lands mid-session — merge by id.
			this.entries = mergeActivityEntries(this.entries, rows).slice(0, DOCS_ACTIVITY_MAX_ITEMS);
			this.total = page?.total ?? this.entries.length;
		} catch {
			this.loadError = true;
			// A failed "Show more" must not lose the rows already on screen, and the retry
			// button has to re-ask for the page that failed — so `page` is left where it is.
		} finally {
			this.loading = false;
		}
	}

	/** Retry target for the inline error: re-asks for the page that failed, keeping what loaded. */
	retry(): void {
		void this.load();
	}

	// ─── Presentation ────────────────────────────────────────────

	/** "System" for pipeline-owned transitions, the author's name otherwise. */
	actorLabel(entry: IDocumentActivityEntry): string {
		if (entry.isSystem) return this.getTranslation('DOCS.ACTIVITY.SYSTEM');
		return entry.actorName || this.getTranslation('DOCS.ACTIVITY.UNKNOWN_ACTOR');
	}

	/** Translated action, or the raw stored action for anything outside `ActionTypeEnum`. */
	actionLabel(entry: IDocumentActivityEntry): string {
		return entry.actionLabelKey ? this.translateOrRaw(entry.actionLabelKey, entry.action) : entry.action;
	}

	/** Translated column name, or the raw column for anything outside the label map. */
	fieldLabel(change: IDocumentActivityChange): string {
		return change.labelKey ? this.translateOrRaw(change.labelKey, change.field) : change.field;
	}

	/** True when the change carries a before/after pair worth printing. */
	hasValues(change: IDocumentActivityChange): boolean {
		return change.showValues && (this.isPrintable(change.previous) || this.isPrintable(change.next));
	}

	/** Enum member → its label; booleans → Yes/No; anything else → its own text. */
	valueLabel(change: IDocumentActivityChange, value: unknown): string {
		if (!this.isPrintable(value)) return '—';
		if (typeof value === 'boolean') {
			return this.getTranslation(value ? 'DOCS.ACTIVITY.VALUE.TRUE' : 'DOCS.ACTIVITY.VALUE.FALSE');
		}
		const raw = String(value);
		return change.valueKeyPrefix ? this.translateOrRaw(`${change.valueKeyPrefix}${raw}`, raw) : raw;
	}

	trackEntry(_: number, entry: IDocumentActivityEntry): string {
		return entry.id;
	}

	trackChange(_: number, change: IDocumentActivityChange): string {
		return change.field;
	}

	private isPrintable(value: unknown): boolean {
		return value !== undefined && value !== null && value !== '';
	}

	/**
	 * Translates a key, falling back to the raw stored text when the key does not exist.
	 *
	 * 🛑 `custom-handler.ts` returns a missing key **verbatim**, so `instant()` cannot be trusted
	 * to have found anything: comparing the result against the key is the only way to tell a
	 * translation from a miss, and the miss must render the raw enum (spec 04 §4.6).
	 */
	private translateOrRaw(key: string, raw: string): string {
		const translated = this.getTranslation(key);
		return !translated || translated === key ? raw : translated;
	}
}
