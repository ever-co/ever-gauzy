import { Params } from '@angular/router';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	ID
} from '@gauzy/contracts';
import { DOCS_DEFAULT_PAGE_SIZE } from '../docs.constants';

/**
 * Canonical filter state for the browse view. The URL is the single source of
 * truth for shareable state — see `04-frontend-plugin.md` §6 / `01-ux-spec.md` §5.1.
 */
export interface DocsFilterState {
	q: string;
	searchIn: 'name' | 'content';
	kind: DocumentKindEnum[];
	status: DocumentStatusEnum[];
	knowledgeStatus: DocumentKnowledgeStatusEnum[];
	reviewStatus: DocumentReviewStatusEnum[];
	source: DocumentSourceEnum[];
	categoryIds: ID[];
	tagIds: ID[];
	archived: boolean;
	/** Active preset chip id — canonical ids per `01-ux-spec.md` §5.1. */
	preset?: DocsPresetId;
	createdFrom?: string; // yyyy-MM-dd
	createdTo?: string;
	updatedFrom?: string;
	updatedTo?: string;
	sort?: { field: string; order: 'ASC' | 'DESC' };
}

/** Canonical preset chip ids (URL values). */
export type DocsPresetId = 'needs-review' | 'not-in-knowledge' | 'archived';

export const DOCS_PRESETS: DocsPresetId[] = ['needs-review', 'not-in-knowledge', 'archived'];

export function createInitialDocsFilterState(): DocsFilterState {
	return {
		q: '',
		searchIn: 'name',
		kind: [],
		status: [],
		knowledgeStatus: [],
		reviewStatus: [],
		source: [],
		categoryIds: [],
		tagIds: [],
		archived: false,
		preset: undefined,
		createdFrom: undefined,
		createdTo: undefined,
		updatedFrom: undefined,
		updatedTo: undefined,
		sort: { field: 'updatedAt', order: 'DESC' }
	};
}

export function isDefaultSort(sort?: DocsFilterState['sort']): boolean {
	return !sort || (sort.field === 'updatedAt' && sort.order === 'DESC');
}

/** True when any non-default filter is active (drives the "no results" empty state). */
export function hasActiveFilters(filter: DocsFilterState): boolean {
	return !!(
		filter.q ||
		filter.preset ||
		filter.kind.length ||
		filter.status.length ||
		filter.knowledgeStatus.length ||
		filter.reviewStatus.length ||
		filter.source.length ||
		filter.categoryIds.length ||
		filter.tagIds.length ||
		filter.archived ||
		filter.createdFrom ||
		filter.createdTo ||
		filter.updatedFrom ||
		filter.updatedTo
	);
}

// ─── URL codec (whitelist-validated both directions) ─────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** UPLOADED never appears in the URL — it folds into PROCESSING for users. */
const URL_STATUS_WHITELIST = [DocumentStatusEnum.READY, DocumentStatusEnum.PROCESSING, DocumentStatusEnum.FAILED];

function parseCsvEnum<T extends string>(raw: string | undefined | null, allowed: readonly T[]): T[] {
	if (!raw) return [];
	const set = new Set<string>(allowed);
	return [...new Set(raw.split(','))].filter((v): v is T => set.has(v));
}

function parseCsvIds(raw: string | undefined | null): ID[] {
	if (!raw) return [];
	return [...new Set(raw.split(','))].filter((v) => !!v.trim());
}

function parseDate(raw: string | undefined | null): string | undefined {
	return raw && DATE_RE.test(raw) ? raw : undefined;
}

/**
 * Restores filter state from query params. Unknown enum members, invalid dates
 * and malformed sorts are silently dropped per the §6 restore rules.
 */
export function parseDocsFilterFromParams(params: Params): DocsFilterState {
	const state = createInitialDocsFilterState();

	state.q = typeof params['q'] === 'string' ? params['q'] : '';
	state.searchIn = params['searchIn'] === 'content' ? 'content' : 'name';
	state.kind = parseCsvEnum(params['kind'], Object.values(DocumentKindEnum));
	state.status = parseCsvEnum(params['status'], URL_STATUS_WHITELIST);
	state.knowledgeStatus = parseCsvEnum(params['knowledge'], Object.values(DocumentKnowledgeStatusEnum));
	state.source = parseCsvEnum(params['source'], Object.values(DocumentSourceEnum));
	// Free-text facet ids are accepted before facets load (deep links from AI chat).
	state.categoryIds = parseCsvIds(params['categories']);
	state.tagIds = parseCsvIds(params['tags']);
	state.createdFrom = parseDate(params['createdFrom']);
	state.createdTo = parseDate(params['createdTo']);
	state.updatedFrom = parseDate(params['updatedFrom']);
	state.updatedTo = parseDate(params['updatedTo']);

	const preset = params['preset'];
	if (DOCS_PRESETS.includes(preset)) {
		state.preset = preset;
		applyPreset(state, preset);
	}

	const sort = typeof params['sort'] === 'string' ? params['sort'] : '';
	const [field, order] = sort.split(':');
	if (field && (order === 'asc' || order === 'desc')) {
		state.sort = { field, order: order.toUpperCase() as 'ASC' | 'DESC' };
	}

	return state;
}

/** Applies the filter values a preset implies (per `01-ux-spec.md` §5.1). */
export function applyPreset(state: DocsFilterState, preset: DocsPresetId | undefined): DocsFilterState {
	state.preset = preset ?? undefined;
	state.reviewStatus = [];
	state.archived = false;
	switch (preset) {
		case 'needs-review':
			state.reviewStatus = [DocumentReviewStatusEnum.PENDING];
			break;
		case 'not-in-knowledge':
			state.knowledgeStatus = [DocumentKnowledgeStatusEnum.NONE, DocumentKnowledgeStatusEnum.EXCLUDED];
			break;
		case 'archived':
			state.archived = true;
			break;
	}
	return state;
}

/**
 * Serializes the filter state into query params. Params at their default value
 * are set to `null` so a merge write removes them from the URL.
 */
export function docsFilterToParams(filter: DocsFilterState, pagination?: { page: number; pageSize: number }): Params {
	const csv = (values: string[]): string | null => (values.length ? values.join(',') : null);
	// Presets own their implied filter values — implied values are not duplicated in the URL.
	const implied = filter.preset ? applyPreset({ ...createInitialDocsFilterState() }, filter.preset) : null;
	const minus = <T extends string>(values: T[], impliedValues?: T[]): T[] =>
		impliedValues?.length ? values.filter((v) => !impliedValues.includes(v)) : values;

	return {
		q: filter.q || null,
		searchIn: filter.searchIn === 'content' ? 'content' : null,
		preset: filter.preset ?? null,
		kind: csv(filter.kind),
		status: csv(filter.status.filter((s) => s !== DocumentStatusEnum.UPLOADED)),
		knowledge: csv(minus(filter.knowledgeStatus, implied?.knowledgeStatus)),
		source: csv(filter.source),
		categories: csv(filter.categoryIds as string[]),
		tags: csv(filter.tagIds as string[]),
		createdFrom: filter.createdFrom ?? null,
		createdTo: filter.createdTo ?? null,
		updatedFrom: filter.updatedFrom ?? null,
		updatedTo: filter.updatedTo ?? null,
		sort: isDefaultSort(filter.sort) ? null : `${filter.sort!.field}:${filter.sort!.order.toLowerCase()}`,
		page: pagination && pagination.page > 1 ? pagination.page : null,
		pageSize: pagination && pagination.pageSize !== DOCS_DEFAULT_PAGE_SIZE ? pagination.pageSize : null
	};
}
