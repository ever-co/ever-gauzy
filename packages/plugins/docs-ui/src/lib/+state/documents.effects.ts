import { Injectable } from '@angular/core';
import { Params, Router } from '@angular/router';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, debounceTime, EMPTY, switchMap, tap } from 'rxjs';
import { IDocument, IPagination } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DOCS_CARDS_PAGE_SIZE, DOCS_DEFAULT_PAGE_SIZE, DOCS_FILTER_DEBOUNCE_MS } from '../docs.constants';
import { IDocumentFindInput } from '../models/docs-api.model';
import { applyPreset, createInitialDocsFilterState, docsFilterToParams } from '../models/docs-filter.model';
import { DocumentsService } from '../services/documents.service';
import { DocumentsActions } from './documents.actions';
import { DocumentsQuery } from './documents.query';
import { DocumentsStore } from './documents.store';

/**
 * Effects for the Documents hub browse state: debounced loads, stale-response
 * rejection via `loadSeq`, facet refresh on settle, and the URL write side
 * effect (merge write, `replaceUrl: true`). Effects never write the URL on
 * `pollTick`.
 */
@Injectable()
export class DocumentsEffects {
	constructor(
		private readonly action$: Actions,
		private readonly documentsStore: DocumentsStore,
		private readonly documentsQuery: DocumentsQuery,
		private readonly documentsService: DocumentsService,
		private readonly store: Store,
		private readonly router: Router
	) {}

	// ─── Filter / preset / folder / pagination ───────────────────

	filterChanged$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.filterChanged),
			tap(({ filter }) => {
				this.documentsStore.updateFilter(filter);
				this.documentsStore.update({ pagination: { ...this.documentsQuery.pagination, page: 1 } });
			}),
			debounceTime(DOCS_FILTER_DEBOUNCE_MS),
			tap(() => {
				this.writeStateToUrl();
				this.action$.dispatch(DocumentsActions.loadDocuments());
			})
		)
	);

	presetToggled$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.presetToggled),
			tap(({ preset }) => {
				// Presets replace their implied facet values on a clean base.
				const base = createInitialDocsFilterState();
				const current = this.documentsQuery.filter;
				const next = applyPreset(
					{ ...base, q: current.q, searchIn: current.searchIn, sort: current.sort },
					preset
				);
				this.documentsStore.update({
					filter: next,
					pagination: { ...this.documentsQuery.pagination, page: 1 },
					selectedIds: []
				});
				this.writeStateToUrl();
				this.action$.dispatch(DocumentsActions.loadDocuments());
			})
		)
	);

	folderChanged$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.folderChanged),
			tap(({ folderId }) => {
				this.documentsStore.update({
					folderId,
					pagination: { ...this.documentsQuery.pagination, page: 1 },
					selectedIds: []
				});
				this.writeStateToUrl();
				this.action$.dispatch(DocumentsActions.loadDocuments());
			})
		)
	);

	/**
	 * Table ↔ cards switch. Each view owns its page size (table 10, cards 24) and
	 * both reset to page 1 — a cards "Load more" run must not leak an oversized
	 * window into the table. Switching away from the table clears its selection.
	 */
	viewChanged$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.viewChanged),
			tap(({ view }) => {
				if (this.documentsQuery.view === view) return;
				this.documentsStore.update({
					view,
					selectedIds: view === 'cards' ? [] : this.documentsQuery.selectedIds,
					pagination: {
						page: 1,
						pageSize: view === 'cards' ? DOCS_CARDS_PAGE_SIZE : DOCS_DEFAULT_PAGE_SIZE
					}
				});
			})
		)
	);

	paginationChanged$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.paginationChanged),
			tap(({ pagination }) => {
				this.documentsStore.update({ pagination });
				this.writeStateToUrl();
				this.action$.dispatch(DocumentsActions.loadDocuments());
			})
		)
	);

	// ─── Detail panel / selection / row patches ──────────────────

	detailOpened$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.detailOpened),
			tap(({ id }) => {
				this.documentsStore.update({ detailId: id });
				this.mergeUrlParams({ id: String(id) });
			})
		)
	);

	detailClosed$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.detailClosed),
			tap(() => {
				this.documentsStore.update({ detailId: null });
				this.mergeUrlParams({ id: null });
			})
		)
	);

	selectionChanged$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.selectionChanged),
			tap(({ ids }) => this.documentsStore.update({ selectedIds: ids }))
		)
	);

	rowChanged$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.rowChanged),
			tap(({ document }) => this.documentsStore.patchRow(document))
		)
	);

	rowRemoved$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.rowRemoved),
			tap(({ id }) => {
				this.documentsStore.removeRow(id);
				if (String(this.documentsQuery.detailId) === String(id)) {
					this.action$.dispatch(DocumentsActions.detailClosed());
				}
			})
		)
	);

	bulkCompleted$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.bulkCompleted),
			tap(({ options }) => {
				if (options?.destructive) {
					this.documentsStore.update({ selectedIds: [] });
				}
				this.action$.dispatch(DocumentsActions.loadDocuments());
				this.action$.dispatch(DocumentsActions.refreshFacets());
			})
		)
	);

	// ─── Loading ─────────────────────────────────────────────────

	loadDocuments$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.loadDocuments),
			switchMap(({ options }) => {
				const silent = !!options?.silent;
				const seq = this.documentsStore.nextLoadSeq();
				if (!silent) {
					this.documentsStore.update({ loading: true, error: false });
				}
				// 'accumulated' keeps an already loaded-more cards grid whole.
				return this.documentsService.getAll(this.buildFindInput('accumulated')).pipe(
					tap((result: IPagination<IDocument>) => {
						if (seq !== this.documentsStore.state.loadSeq) return; // stale response
						this.documentsStore.update({
							rows: result.items ?? [],
							totalCount: result.total ?? 0,
							loading: false,
							error: false
						});
						if (!silent) {
							this.action$.dispatch(DocumentsActions.refreshFacets());
						}
					}),
					catchError(() => {
						if (seq === this.documentsStore.state.loadSeq && !silent) {
							this.documentsStore.update({ loading: false, error: true });
						}
						return EMPTY;
					})
				);
			})
		)
	);

	/**
	 * Cards "Load more" (`01-ux-spec.md` §4.2): bumps the page, fetches ONLY that
	 * slice and appends it. No URL write — the shareable link stays page 1. A
	 * failed append rolls the page counter back so the button stays usable.
	 */
	loadMore$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.loadMore),
			switchMap(() => {
				const { pagination, rows, totalCount, loading } = this.documentsStore.state;
				if (loading || rows.length >= totalCount) return EMPTY;

				const previousPage = pagination.page;
				this.documentsStore.update({
					pagination: { ...pagination, page: previousPage + 1 },
					loading: true,
					error: false
				});
				const seq = this.documentsStore.nextLoadSeq();

				// 'page' window: just the newly requested slice, not the accumulation.
				return this.documentsService.getAll(this.buildFindInput('page')).pipe(
					tap((result: IPagination<IDocument>) => {
						if (seq !== this.documentsStore.state.loadSeq) return; // stale response
						this.documentsStore.appendRows(result.items ?? [], result.total ?? totalCount);
						this.documentsStore.update({ loading: false });
					}),
					catchError(() => {
						if (seq === this.documentsStore.state.loadSeq) {
							this.documentsStore.update({
								pagination: { ...this.documentsStore.state.pagination, page: previousPage },
								loading: false
							});
						}
						return EMPTY;
					})
				);
			})
		)
	);

	/** Silent in-place refresh — no spinner, no pagination reset, no URL write. */
	pollTick$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.pollTick),
			switchMap(() =>
				// UploadQueueService fetches its off-page ids individually; the effect
				// only refreshes the visible page in place.
				this.documentsService.getAll(this.buildFindInput('accumulated')).pipe(
					tap((result) => {
						this.documentsStore.update({ rows: result.items ?? [], totalCount: result.total ?? 0 });
					}),
					catchError(() => EMPTY)
				)
			)
		)
	);

	/** Cosmetic — facets and counts fail silently. */
	refreshFacets$ = createEffect(() =>
		this.action$.pipe(
			ofType(DocumentsActions.refreshFacets),
			switchMap(() =>
				this.documentsService.getFacets(this.buildFindInput('facets')).pipe(
					tap((facets) => {
						this.documentsStore.update({
							facets,
							presetCounts: facets?.presets
								? {
										all: facets.presets.all ?? 0,
										needsReview: facets.presets.needsReview ?? 0,
										notInKnowledge: facets.presets.notInKnowledge ?? 0,
										archived: facets.presets.archived ?? 0
								  }
								: this.documentsStore.state.presetCounts
						});
					}),
					catchError(() => EMPTY)
				)
			)
		)
	);

	// ─── Internals ───────────────────────────────────────────────

	/**
	 * Builds the list query.
	 *
	 * @param window
	 *  - `'page'` — exactly the current page slice (table paging, cards Load more).
	 *  - `'accumulated'` — in the cards view past page 1, the whole loaded window
	 *    (`skip: 0`, `take: page × pageSize`) so a reload or a poll refresh does
	 *    not silently truncate an appended grid back to one page.
	 *  - `'facets'` — no window at all (facet counts are computed over the filter).
	 */
	private buildFindInput(window: 'page' | 'accumulated' | 'facets' = 'page'): IDocumentFindInput {
		const { filter, folderId, pagination, view } = this.documentsStore.state;
		const { organizationId, tenantId } = this.orgContext();
		const input: IDocumentFindInput = {
			organizationId,
			tenantId,
			// 🛑 `GetDocumentsQueryDTO.archived` is `@IsIn(['exclude','include','only'])`
			// — the service maps this boolean, never send it raw.
			archived: filter.archived,
			relations: ['categories', 'tags']
		};
		// 🛑 The DTO's `kind` is a scalar `@IsEnum`. A multi-kind selection cannot be
		// expressed server-side, so the service drops it (a wider result set beats a 400).
		if (filter.kind.length) input.kind = filter.kind;
		if (filter.status.length) input.status = filter.status;
		if (filter.knowledgeStatus.length) input.knowledgeStatus = filter.knowledgeStatus;
		if (filter.reviewStatus.length) input.reviewStatus = filter.reviewStatus;
		if (filter.source.length) input.source = filter.source;
		if (filter.categoryIds.length) input.categoryIds = filter.categoryIds;
		if (filter.tagIds.length) input.tagIds = filter.tagIds;
		if (filter.q) {
			input.q = filter.q;
			input.searchIn = filter.searchIn;
		} else if (folderId) {
			// Folder scope applies only without a search — search results are flat.
			input.parentId = folderId;
		}
		// The DTO names are `createdAt*`/`updatedAt*`; the URL param names
		// (`createdFrom`…) are the shareable-link contract and stay as they are.
		if (filter.createdFrom) input.createdAtFrom = filter.createdFrom;
		if (filter.createdTo) input.createdAtTo = filter.createdTo;
		if (filter.updatedFrom) input.updatedAtFrom = filter.updatedFrom;
		if (filter.updatedTo) input.updatedAtTo = filter.updatedTo;
		// Two separate params — a composite `updatedAt:desc` fails `@IsIn` on `sort`.
		if (filter.sort) {
			input.sort = filter.sort.field;
			input.sortOrder = filter.sort.order;
		}
		if (window !== 'facets') {
			const accumulate = window === 'accumulated' && view === 'cards' && pagination.page > 1;
			// 🛑 `skip` is a 1-based PAGE NUMBER, not an offset: the API computes
			// `offset = take × (skip − 1)`, so sending a row offset paged in steps of
			// `pageSize²` (page 2 of 10 landed on rows 91-100). The accumulated window
			// is one big page-1 request; the service clamps `take` to the DTO's `@Max(100)`.
			input.skip = accumulate ? 1 : pagination.page;
			input.take = accumulate ? pagination.page * pagination.pageSize : pagination.pageSize;
		}
		return input;
	}

	private orgContext(): { organizationId?: string; tenantId?: string } {
		const organization = this.store.selectedOrganization;
		return organization ? { organizationId: organization.id, tenantId: organization.tenantId } : {};
	}

	/** Single URL write funnel — merge write, `replaceUrl: true`, no history spam. */
	private writeStateToUrl(): void {
		const { filter, folderId, pagination, detailId } = this.documentsStore.state;
		const params: Params = {
			...docsFilterToParams(filter, pagination),
			folder: folderId ? String(folderId) : null,
			id: detailId ? String(detailId) : null
		};
		this.mergeUrlParams(params);
	}

	private mergeUrlParams(params: Params): void {
		this.router.navigate([], {
			queryParams: params,
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}
}
