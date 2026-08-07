import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_CONTENT_SEARCH_MIN_CHARS } from '../../docs.constants';
import { IDocumentFacetBucket, IDocumentFacets } from '../../models/docs-api.model';
import { DocsFilterState } from '../../models/docs-filter.model';

/**
 * Filter bar: multi-select facet dropdowns (with live counts), created/updated
 * date-range pickers, the name-vs-content search scope toggle (content search
 * needs ≥ 2 characters) and clear-all. Emits a single `filterChange` per
 * mutation; the browse page owns debouncing + URL sync.
 */
@Component({
	selector: 'gz-docs-filter-bar',
	templateUrl: './docs-filter-bar.component.html',
	styleUrls: ['./docs-filter-bar.component.scss'],
	standalone: false
})
export class DocsFilterBarComponent extends TranslationBaseComponent {
	@Input() facets: IDocumentFacets | null = null;
	@Input() value: DocsFilterState | null = null;
	/** Live URL query params — what the saved-views control captures and compares against. */
	@Input() urlParams: Params = {};
	@Output() filterChange = new EventEmitter<Partial<DocsFilterState>>();
	@Output() searchChange = new EventEmitter<string>();
	@Output() clearAll = new EventEmitter<void>();
	/** A saved view was applied — payload is the query-param merge patch. */
	@Output() applyView = new EventEmitter<Params>();

	public readonly contentSearchMinChars = DOCS_CONTENT_SEARCH_MIN_CHARS;

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	// ─── Facet buckets (fall back to full enums when facets are unloaded) ───

	get kindBuckets(): IDocumentFacetBucket[] {
		return this.bucketsOrEnum(this.facets?.kind, Object.values(DocumentKindEnum));
	}

	get statusBuckets(): IDocumentFacetBucket[] {
		// UPLOADED folds into PROCESSING — filters offer only READY/PROCESSING/FAILED.
		const values = [DocumentStatusEnum.READY, DocumentStatusEnum.PROCESSING, DocumentStatusEnum.FAILED];
		return this.bucketsOrEnum(
			this.facets?.status?.filter((bucket) => bucket.value !== DocumentStatusEnum.UPLOADED),
			values
		);
	}

	get knowledgeBuckets(): IDocumentFacetBucket[] {
		return this.bucketsOrEnum(this.facets?.knowledgeStatus, Object.values(DocumentKnowledgeStatusEnum));
	}

	get sourceBuckets(): IDocumentFacetBucket[] {
		return this.bucketsOrEnum(this.facets?.source, Object.values(DocumentSourceEnum));
	}

	get categoryBuckets(): IDocumentFacetBucket[] {
		return this.facets?.categories ?? [];
	}

	get tagBuckets(): IDocumentFacetBucket[] {
		return this.facets?.tags ?? [];
	}

	kindLabel = (value: string): string => this.getTranslation(`DOCS.KIND.${value}`);
	statusLabel = (value: string): string => this.getTranslation(`DOCS.STATUS.${value}`);
	knowledgeLabel = (value: string): string => this.getTranslation(`DOCS.KNOWLEDGE.${value}`);
	sourceLabel = (value: string): string => this.getTranslation(`DOCS.SOURCE.${value}`);

	// ─── Emitters ────────────────────────────────────────────────

	onSearchInput(q: string): void {
		this.searchChange.emit(q ?? '');
	}

	onSearchScopeToggle(content: boolean): void {
		this.filterChange.emit({ searchIn: content ? 'content' : 'name' });
	}

	onFacet(field: keyof DocsFilterState, values: string[]): void {
		this.filterChange.emit({ [field]: values } as Partial<DocsFilterState>);
	}

	onCreatedRange(range: { start?: Date; end?: Date }): void {
		this.filterChange.emit({
			createdFrom: this.toIsoDate(range?.start),
			createdTo: this.toIsoDate(range?.end)
		});
	}

	onUpdatedRange(range: { start?: Date; end?: Date }): void {
		this.filterChange.emit({
			updatedFrom: this.toIsoDate(range?.start),
			updatedTo: this.toIsoDate(range?.end)
		});
	}

	onClearAll(): void {
		this.clearAll.emit();
	}

	get contentSearchDisabled(): boolean {
		return (this.value?.q ?? '').length < this.contentSearchMinChars;
	}

	// ─── Internals ───────────────────────────────────────────────

	private bucketsOrEnum(buckets: IDocumentFacetBucket[] | undefined, values: string[]): IDocumentFacetBucket[] {
		if (buckets?.length) return buckets;
		return values.map((value) => ({ value, count: undefined as unknown as number }));
	}

	private toIsoDate(date?: Date): string | undefined {
		if (!date) return undefined;
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`;
	}
}
