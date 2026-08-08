import { Injectable } from '@angular/core';
import { select } from '@ngneat/elf';
import { Observable } from 'rxjs';
import { DocumentKnowledgeStatusEnum, DocumentStatusEnum, ID, IDocument } from '@gauzy/contracts';
import { IDocumentFacets } from '../models/docs-api.model';
import { DocsFilterState } from '../models/docs-filter.model';
import { DocsPresetCounts, DocsState, DocumentsStore } from './documents.store';

/** Memoized selectors over the docs elf store. */
@Injectable()
export class DocumentsQuery {
	constructor(private readonly documentsStore: DocumentsStore) {}

	private select<R>(project: (state: DocsState) => R): Observable<R> {
		return this.documentsStore.store.pipe(select(project));
	}

	public readonly rows$: Observable<IDocument[]> = this.select((state) => state.rows);
	public readonly totalCount$: Observable<number> = this.select((state) => state.totalCount);
	public readonly loading$: Observable<boolean> = this.select((state) => state.loading);
	public readonly error$: Observable<boolean> = this.select((state) => state.error);
	public readonly filter$: Observable<DocsFilterState> = this.select((state) => state.filter);
	public readonly view$: Observable<'table' | 'cards'> = this.select((state) => state.view);
	public readonly folderId$: Observable<ID | null> = this.select((state) => state.folderId);
	public readonly selection$: Observable<ID[]> = this.select((state) => state.selectedIds);
	public readonly detailId$: Observable<ID | null> = this.select((state) => state.detailId);
	public readonly facets$: Observable<IDocumentFacets | null> = this.select((state) => state.facets);
	public readonly presetCounts$: Observable<DocsPresetCounts | null> = this.select((state) => state.presetCounts);
	public readonly pagination$: Observable<{ page: number; pageSize: number }> = this.select(
		(state) => state.pagination
	);

	/** True while any visible row is still processing or indexing — drives the 5 s poll. */
	public readonly isProcessingVisible$: Observable<boolean> = this.select((state) =>
		state.rows.some(
			(row) =>
				row.status === DocumentStatusEnum.UPLOADED ||
				row.status === DocumentStatusEnum.PROCESSING ||
				row.knowledgeStatus === DocumentKnowledgeStatusEnum.QUEUED ||
				row.knowledgeStatus === DocumentKnowledgeStatusEnum.INDEXING
		)
	);

	// Snapshot getters
	public get rows(): IDocument[] {
		return this.documentsStore.state.rows;
	}

	public get filter(): DocsFilterState {
		return this.documentsStore.state.filter;
	}

	public get view(): 'table' | 'cards' {
		return this.documentsStore.state.view;
	}

	public get folderId(): ID | null {
		return this.documentsStore.state.folderId;
	}

	public get selectedIds(): ID[] {
		return this.documentsStore.state.selectedIds;
	}

	public get detailId(): ID | null {
		return this.documentsStore.state.detailId;
	}

	public get pagination(): { page: number; pageSize: number } {
		return this.documentsStore.state.pagination;
	}
}
