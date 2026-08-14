import { createAction } from '@ngneat/effects';
import { ID, IDocument } from '@gauzy/contracts';
import { DocsFilterState, DocsPresetId } from '../models/docs-filter.model';

export class DocumentsActions {
	/** Loads the current page from the API (respects filter/folder/pagination in the store). */
	public static loadDocuments = createAction('[Docs] Load Documents', (options?: { silent?: boolean }) => ({
		options
	}));

	/**
	 * Cards "Load more": fetches the next page and APPENDS it to `rows`
	 * (`01-ux-spec.md` §4.2). Never resets pagination and never writes the URL —
	 * the shareable state stays the first page.
	 */
	public static loadMore = createAction('[Docs] Load More');

	/** Merges a partial filter change, debounced into a reload + URL write. */
	public static filterChanged = createAction('[Docs] Filter Changed', (filter: Partial<DocsFilterState>) => ({
		filter
	}));

	/** Toggles a preset chip (undefined = back to All). */
	public static presetToggled = createAction('[Docs] Preset Toggled', (preset?: DocsPresetId) => ({ preset }));

	/** Table/cards toggle — persisted through `ComponentEnum.DOCUMENTS_HUB`. */
	public static viewChanged = createAction('[Docs] View Changed', (view: 'table' | 'cards') => ({ view }));

	/** Tree scope change (null = root). */
	public static folderChanged = createAction('[Docs] Folder Changed', (folderId: ID | null) => ({ folderId }));

	public static paginationChanged = createAction(
		'[Docs] Pagination Changed',
		(pagination: { page: number; pageSize: number }) => ({ pagination })
	);

	public static detailOpened = createAction('[Docs] Detail Opened', (id: ID) => ({ id }));

	public static detailClosed = createAction('[Docs] Detail Closed');

	public static selectionChanged = createAction('[Docs] Selection Changed', (ids: ID[]) => ({ ids }));

	/** A single row mutated (detail edit / poll refresh) — patch it in place. */
	public static rowChanged = createAction('[Docs] Row Changed', (document: IDocument) => ({ document }));

	/** A row disappeared from the current scope (archive/delete/move). */
	public static rowRemoved = createAction('[Docs] Row Removed', (id: ID) => ({ id }));

	/** A bulk action finished — reload list + facets, clear selection when destructive. */
	public static bulkCompleted = createAction('[Docs] Bulk Completed', (options?: { destructive?: boolean }) => ({
		options
	}));

	/** 5 s processing poll tick — silent in-place refresh; never writes the URL. */
	public static pollTick = createAction('[Docs] Poll Tick', (ids?: ID[]) => ({ ids }));

	/** Refreshes facets + preset counts (on settle / after mutations). */
	public static refreshFacets = createAction('[Docs] Refresh Facets');
}
