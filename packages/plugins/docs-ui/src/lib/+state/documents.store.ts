import { Injectable } from '@angular/core';
import { createStore, withProps } from '@ngneat/elf';
import { ID, IDocument } from '@gauzy/contracts';
import { DOCS_DEFAULT_PAGE_SIZE } from '../docs.constants';
import { IDocumentFacets } from '../models/docs-api.model';
import { createInitialDocsFilterState, DocsFilterState } from '../models/docs-filter.model';

/** Preset chip live counts (All / Needs review / Not in AI knowledge / Archived). */
export interface DocsPresetCounts {
	all: number;
	needsReview: number;
	notInKnowledge: number;
	archived: number;
}

export interface DocsState {
	rows: IDocument[];
	totalCount: number;
	loading: boolean;
	error: boolean;
	filter: DocsFilterState;
	view: 'table' | 'cards';
	folderId: ID | null;
	selectedIds: ID[];
	detailId: ID | null;
	facets: IDocumentFacets | null;
	presetCounts: DocsPresetCounts | null;
	pagination: { page: number; pageSize: number };
	/** Monotonic token — stale list responses are discarded. */
	loadSeq: number;
}

export function createInitialDocsState(): DocsState {
	return {
		rows: [],
		totalCount: 0,
		loading: false,
		error: false,
		filter: createInitialDocsFilterState(),
		view: 'table',
		folderId: null,
		selectedIds: [],
		detailId: null,
		facets: null,
		presetCounts: null,
		pagination: { page: 1, pageSize: DOCS_DEFAULT_PAGE_SIZE },
		loadSeq: 0
	};
}

/**
 * Single elf store for the Documents hub browse state.
 * Provided at module level (not root) so the state dies with the lazy chunk.
 */
@Injectable()
export class DocumentsStore {
	readonly store = createStore({ name: 'docs' }, withProps<DocsState>(createInitialDocsState()));

	get state(): DocsState {
		return this.store.getValue();
	}

	update(partial: Partial<DocsState>): void {
		this.store.update((state) => ({ ...state, ...partial }));
	}

	updateFilter(partial: Partial<DocsFilterState>): void {
		this.store.update((state) => ({ ...state, filter: { ...state.filter, ...partial } }));
	}

	/** Bumps and returns the load sequence token for stale-response rejection. */
	nextLoadSeq(): number {
		const seq = this.state.loadSeq + 1;
		this.update({ loadSeq: seq });
		return seq;
	}

	/**
	 * Appends the next page for the cards "Load more" button, de-duplicating by
	 * id (a concurrent poll may already have re-fetched an overlapping window).
	 */
	appendRows(rows: IDocument[], totalCount: number): void {
		this.store.update((state) => {
			const seen = new Set(state.rows.map((row) => String(row.id)));
			const additions = (rows ?? []).filter((row) => !seen.has(String(row.id)));
			return { ...state, rows: [...state.rows, ...additions], totalCount };
		});
	}

	/** Replaces a single row in place (silent poll refresh / detail mutation). */
	patchRow(document: IDocument): void {
		this.store.update((state) => ({
			...state,
			rows: state.rows.map((row) => (String(row.id) === String(document.id) ? { ...row, ...document } : row))
		}));
	}

	removeRow(id: ID): void {
		this.store.update((state) => ({
			...state,
			rows: state.rows.filter((row) => String(row.id) !== String(id)),
			selectedIds: state.selectedIds.filter((selected) => String(selected) !== String(id)),
			totalCount: Math.max(0, state.totalCount - 1)
		}));
	}

	reset(): void {
		this.store.update(() => createInitialDocsState());
	}
}
