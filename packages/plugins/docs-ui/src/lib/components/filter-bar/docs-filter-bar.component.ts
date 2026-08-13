import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	ID,
	ITag
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_CONTENT_SEARCH_MIN_CHARS } from '../../docs.constants';
import { IDocumentFacetBucket, IDocumentFacets } from '../../models/docs-api.model';
import { DocsFilterState, foldStatusFacetBuckets } from '../../models/docs-filter.model';

/**
 * Filter bar: multi-select facet dropdowns (with live counts), the create-capable
 * tag selector, created/updated date-range pickers, the name-vs-content search
 * scope toggle (content search needs ≥ `DOCS_CONTENT_SEARCH_MIN_CHARS` characters
 * — the backend's own minimum, never a locally chosen one) and clear-all. Emits a
 * single `filterChange` per mutation; the browse page owns debouncing + URL sync.
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

	/** Interpolated into `DOCS.FILTERS.SEARCH_CONTENT_DISABLED` so the hint can never quote a stale number. */
	public readonly contentSearchMinChars = DOCS_CONTENT_SEARCH_MIN_CHARS;

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	// ─── Facet buckets (fall back to full enums when facets are unloaded) ───
	//
	// 🛑 These are consumed as `[buckets]="kindBuckets"` template bindings, which Angular
	// re-evaluates on EVERY change-detection cycle. They must therefore return a STABLE array
	// reference while `facets` is unchanged — a fresh `Object.values(...).map(...)` each cycle
	// fed the downstream select a new identity every tick, which recreated its option children
	// and self-retriggered change detection (the Documents-hub main-thread wedge). The cache
	// below is keyed on the `facets` INPUT REFERENCE: the parent (browse page) replaces
	// `facets` wholesale on each load, so identity equality is the correct and cheap
	// invalidation signal.

	private bucketsCache: { source: IDocumentFacets | null; buckets: Record<string, IDocumentFacetBucket[]> } = {
		source: undefined as unknown as IDocumentFacets | null,
		buckets: {}
	};

	private facetBuckets(key: string, compute: () => IDocumentFacetBucket[]): IDocumentFacetBucket[] {
		if (this.bucketsCache.source !== this.facets) {
			this.bucketsCache = { source: this.facets, buckets: {} };
		}
		return (this.bucketsCache.buckets[key] ??= compute());
	}

	get kindBuckets(): IDocumentFacetBucket[] {
		return this.facetBuckets('kind', () => this.bucketsOrEnum(this.facets?.kind, Object.values(DocumentKindEnum)));
	}

	get statusBuckets(): IDocumentFacetBucket[] {
		// UPLOADED folds into PROCESSING — filters offer only READY/PROCESSING/FAILED,
		// and the Processing count carries the still-UPLOADED rows with it (R-STA-02).
		const values = [DocumentStatusEnum.READY, DocumentStatusEnum.PROCESSING, DocumentStatusEnum.FAILED];
		return this.facetBuckets('status', () => this.bucketsOrEnum(foldStatusFacetBuckets(this.facets?.status), values));
	}

	get knowledgeBuckets(): IDocumentFacetBucket[] {
		return this.facetBuckets('knowledge', () =>
			this.bucketsOrEnum(this.facets?.knowledgeStatus, Object.values(DocumentKnowledgeStatusEnum))
		);
	}

	get sourceBuckets(): IDocumentFacetBucket[] {
		return this.facetBuckets('source', () =>
			this.bucketsOrEnum(this.facets?.source, Object.values(DocumentSourceEnum))
		);
	}

	get categoryBuckets(): IDocumentFacetBucket[] {
		return this.facetBuckets('categories', () => this.facets?.categories ?? []);
	}

	get tagBuckets(): IDocumentFacetBucket[] {
		return this.facetBuckets('tags', () => this.facets?.tags ?? []);
	}

	kindLabel = (value: string): string => this.getTranslation(`DOCS.KIND.${value}`);
	statusLabel = (value: string): string => this.getTranslation(`DOCS.STATUS.${value}`);
	knowledgeLabel = (value: string): string => this.getTranslation(`DOCS.KNOWLEDGE.${value}`);
	sourceLabel = (value: string): string => this.getTranslation(`DOCS.SOURCE.${value}`);

	// ─── Tag filter (ga-tags-color-input ↔ tagIds mapping) ──────
	//
	// The shared selector works in `ITag[]` while the filter state carries bare
	// ids (`tagIds` — the URL codec's `tags` CSV param). The getter below derives
	// ITag stubs from the ids, resolving names from the facet buckets and full
	// entities from whatever the selector last emitted (so a store round-trip
	// keeps chip colors). Same stable-reference rule as the buckets above:
	// `[selectedTags]` re-evaluates every cycle and the selector's input is a
	// plain setter, so a fresh array each cycle would re-enter it forever.

	private readonly tagEntityCache = new Map<string, ITag>();
	private tagStubsCache: { signature: string; tags: ITag[] } = { signature: '', tags: [] };

	get selectedTagEntities(): ITag[] {
		const ids = this.value?.tagIds ?? [];
		const buckets = this.tagBuckets;
		const signature = JSON.stringify([ids, buckets.map((bucket) => [bucket.value, bucket.label])]);
		if (signature !== this.tagStubsCache.signature) {
			this.tagStubsCache = {
				signature,
				tags: ids.map((id) => {
					const known = this.tagEntityCache.get(String(id));
					if (known) return known;
					const bucket = buckets.find((b) => String(b.value) === String(id));
					// Deep-linked ids without a facet match stay selectable — a neutral
					// chip beats silently dropping the filter. The color is explicit:
					// the shared selector's `background()` maps a missing color to
					// #000000, so a colorless stub rendered as a black chip. (Nebular's
					// basic-600 gray — facet buckets carry no color to resolve from.)
					return { id, name: bucket?.label ?? String(id), color: '#8f9bb3' } as ITag;
				})
			};
		}
		return this.tagStubsCache.tags;
	}

	onTagsChange(tags: ITag[]): void {
		const next = tags ?? [];
		next.forEach((tag) => {
			if (tag?.id) this.tagEntityCache.set(String(tag.id), tag);
		});
		this.filterChange.emit({ tagIds: next.map((tag) => tag.id as ID) });
	}

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

	get hasCreatedRange(): boolean {
		return !!(this.value?.createdFrom || this.value?.createdTo);
	}

	get hasUpdatedRange(): boolean {
		return !!(this.value?.updatedFrom || this.value?.updatedTo);
	}

	// The rangepicker directive owns the input's text, so clearing the state
	// alone would leave stale text behind — blank the input alongside the emit.

	clearCreatedRange(input: HTMLInputElement): void {
		input.value = '';
		this.onCreatedRange({});
	}

	clearUpdatedRange(input: HTMLInputElement): void {
		input.value = '';
		this.onUpdatedRange({});
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
