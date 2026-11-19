import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';

/**
 * Helper function to validate organization context and return default parameters
 */
export const validateOrganizationContext = () => {
	const defaultParams = authManager.getDefaultParams();

	if (!defaultParams.organizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return defaultParams;
};

/**
 * The organization and tenant a tool acts for: the ones the caller names, else the signed-in user's. A tool given an
 * organization needs none signed in; a tenant neither named nor signed in is left out, as when a tool names none.
 */
export const resolveOrganizationScope = (
	organizationId?: string,
	tenantId?: string
): { organizationId: string; tenantId?: string } => {
	const defaultParams = authManager.getDefaultParams();
	const resolvedOrganizationId = organizationId || defaultParams.organizationId;
	const resolvedTenantId = tenantId || defaultParams.tenantId;

	if (!resolvedOrganizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return {
		organizationId: resolvedOrganizationId,
		...(resolvedTenantId && { tenantId: resolvedTenantId })
	};
};

export interface ListQueryOptions {
	page?: number;
	limit?: number;
	relations?: string[];
	order?: Record<string, 'ASC' | 'DESC'>;
	/** `/pagination` routes read `skip` as a page number, plain list routes as a row offset. */
	skipIsPage?: boolean;
}

/**
 * Query of an API list route that validates `BaseQueryDTO`: `where` is required there and carries the
 * organization scope. Undefined filters are left out of the query string by axios.
 */
export const buildListQuery = (
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	{ page = 1, limit = 10, relations, order, skipIsPage = false }: ListQueryOptions = {}
) => ({
	where: {
		organizationId: defaultParams.organizationId,
		...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
		...where
	},
	take: limit,
	skip: skipIsPage ? page : (page - 1) * limit,
	...(relations && { relations }),
	...(order && { order })
});

/**
 * Reads a list route page by page, for the tools that search or count rows the API only lists.
 * `query` builds the query of one page; `stop` ends the read before the rows run out; `headers` go with every page.
 */
export const readAllPages = async <T>(
	path: string,
	query: (page: number, take: number) => Record<string, unknown>,
	stop?: (items: T[]) => boolean,
	headers?: Record<string, string>
): Promise<T[]> => {
	const take = 100;
	const items: T[] = [];

	for (let page = 1; ; page++) {
		const response = await apiClient.get<{ items?: T[]; total?: number }>(path, {
			params: query(page, take),
			...(headers && { headers })
		});
		const batch = response?.items ?? [];
		items.push(...batch);

		const total = response?.total;
		if (batch.length < take || (total !== undefined && items.length >= total) || stop?.(items)) {
			return items;
		}
	}
};

/** One page of rows the tool filtered itself, in the `{ items, total }` shape of the API lists. */
export const pageOf = <T>(items: T[], page = 1, limit = 10) => ({
	items: items.slice((page - 1) * limit, page * limit),
	total: items.length
});

/**
 * One page of the rows of a list route that `keep` accepts, for a filter the route does not apply: the whole list is
 * read, filtered here, then paged, so the page and the total count only the rows kept.
 */
export const pageOfKept = async <T>(
	path: string,
	query: (page: number, take: number) => Record<string, unknown>,
	keep: (item: T) => boolean,
	page = 1,
	limit = 10,
	headers?: Record<string, string>
) => pageOf((await readAllPages<T>(path, query, undefined, headers)).filter(keep), page, limit);

/**
 * Applies `apply` to each item in turn, for the bulk tools of resources that only have single-item routes.
 * Stops at the first failure and says how many items were applied before it, since those stay applied.
 */
export const applyInTurn = async <T, R>(items: T[], apply: (item: T) => Promise<R>): Promise<R[]> => {
	const results: R[] = [];

	for (const item of items) {
		try {
			results.push(await apply(item));
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Item ${results.length + 1} of ${items.length} failed after ${results.length} applied: ${reason}`
			);
		}
	}

	return results;
};

/**
 * The error a tool answers, before any request, when the Gauzy API has no route for its action. The tool stays
 * listed, so the assistant can tell the person plainly that this server does not offer it; `instead` names a tool
 * that does a close action, when there is one.
 */
export const notOfferedByApi = (action: string, instead?: string): Error => {
	const message = `This server does not offer ${action}: the Gauzy API has no route for that.`;
	if (!instead) {
		return new Error(message);
	}
	return new Error(`${message} ${instead}`);
};

/**
 * Counts the items under each grouping, for the statistics tools the API has no route for.
 * A grouping returns one key per item, or several (an item counted under each).
 */
export const countByGroup = <T>(items: T[], groups: Record<string, (item: T) => unknown>) =>
	Object.fromEntries(
		Object.entries(groups).map(([name, keysOf]) => [
			name,
			items.reduce<Record<string, number>>((counts, item) => {
				for (const key of [keysOf(item)].flat()) {
					const label = String(key ?? 'none');
					counts[label] = (counts[label] ?? 0) + 1;
				}
				return counts;
			}, {})
		])
	);

/** `BaseEntityEnum` names of the entity types the tool schemas spell in capitals. */
const API_ENTITY_NAMES: Record<string, string> = {
	USER: 'User',
	EMPLOYEE: 'Employee',
	TASK: 'Task',
	PROJECT: 'OrganizationProject',
	GOAL: 'Goal',
	INVOICE: 'Invoice',
	EXPENSE: 'Expense',
	CANDIDATE: 'Candidate'
};

/**
 * The API name of an entity type: the tool schemas spell them `TASK` or `PROJECT`, the API `Task` or
 * `OrganizationProject`. Any other value, an API name included, is sent unchanged.
 */
export const toApiEntity = (entity?: string): string | undefined => (entity && API_ENTITY_NAMES[entity]) || entity;

/** The value the API stores for an enum filter given as a key of `values` or as the value itself. */
export const toApiValue = (values: Record<string, string>, filter?: string): string | undefined => {
	const isKey = filter !== undefined && Object.prototype.hasOwnProperty.call(values, filter);
	if (isKey) {
		return values[filter];
	}
	return filter;
};

/** Whether `text` contains `query`, ignoring case; no query matches everything. */
export const containsText = (text: unknown, query?: string): boolean => {
	const needle = query?.toLowerCase();
	const haystack = String(text ?? '').toLowerCase();
	return !needle || haystack.includes(needle);
};

/** Whether one of `texts` contains `query`, ignoring case; no query matches everything. */
export const containsAnyText = (query: string | undefined, ...texts: unknown[]): boolean =>
	texts.some((text) => containsText(text, query));

/** The relations a tool asks for, with the one a search reads from. */
export const withRelation = (relations: string[] | undefined, relation: string): string[] => [
	...new Set([...(relations ?? []), relation])
];

/** A day with no time, as `YYYY-MM-DD`. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An end bound as the instant it means: a day with no time ends at the last instant of that day in UTC, as the API reads
 * an end bound; an instant stays as it is.
 */
export const endOfDayBound = (endDate?: string): string | undefined => {
	const isDateOnly = endDate !== undefined && DATE_ONLY.test(endDate);
	if (!isDateOnly) {
		return endDate;
	}
	return `${endDate}T23:59:59.999Z`;
};

/** Whether `value` falls in the optional `[startDate, endDate]` range. */
export const isWithinDates = (value: string | Date | undefined, startDate?: string, endDate?: string): boolean => {
	if (!startDate && !endDate) {
		return true;
	}
	if (!value) {
		return false;
	}

	const time = new Date(value).getTime();
	return (!startDate || time >= new Date(startDate).getTime()) && (!endDate || time <= new Date(endDate).getTime());
};

/** The employee record of the logged-in user, for the "my ..." tools whose API has no `/me` route. */
export const getCurrentEmployeeId = async (): Promise<string> => {
	const user = await apiClient.get<{ employeeId?: string; employee?: { id?: string } }>('/api/user/me', {
		params: { includeEmployee: true }
	});
	const employeeId = user?.employee?.id ?? user?.employeeId;

	if (!employeeId) {
		throw new Error('The logged-in user has no employee record.');
	}

	return employeeId;
};

/** A person's user, as the API joins it to an employee or a candidate. */
export interface PersonUser {
	firstName?: string;
	lastName?: string;
	email?: string;
}

/** The texts a search of a person's name or email reads. */
export const personTexts = ({ user }: { user?: PersonUser }): unknown[] => [
	`${user?.firstName ?? ''} ${user?.lastName ?? ''}`,
	user?.email
];

/** The relations a tool asks for, with the one its search reads from when it searches. */
export const relationsForSearch = (search: string | undefined, relations: string[] | undefined, relation: string) => {
	if (!search) {
		return relations;
	}
	return withRelation(relations, relation);
};

/** How a list page is read: the page, the rows kept here when the route does not apply a filter, the headers. */
export interface ListPageOptions<T> {
	page?: number;
	limit?: number;
	keep?: (item: T) => boolean;
	headers?: Record<string, string>;
}

/**
 * A page of a list route. With `keep`, for a filter the route does not apply, the whole list is read, filtered here,
 * then paged; without it, the route pages the list itself.
 */
export const readListPage = <T>(
	path: string,
	query: (page: number, take: number) => Record<string, unknown>,
	{ page = 1, limit = 10, keep, headers }: ListPageOptions<T>
) => {
	if (!keep) {
		return apiClient.get(path, { params: query(page, limit), ...(headers && { headers }) });
	}
	return pageOfKept(path, query, keep, page, limit, headers);
};

/** A filter keeping the rows one of whose texts contains `search`, ignoring case; none without a search. */
export const searchingIn = <T>(search: string | undefined, textsOf: (item: T) => unknown[]) => {
	if (!search) {
		return undefined;
	}
	return (item: T) => containsAnyText(search, ...textsOf(item));
};

/** A search a list route does not apply: the term, the texts of a row it reads, the headers of the read. */
export interface ListSearch<T> {
	search?: string;
	textsOf: (item: T) => unknown[];
	headers?: Record<string, string>;
}

/**
 * A page of a `BaseQueryDTO` list route that has no search for what a tool searches: with a search, the rows whose
 * texts contain it are kept here, on the whole list.
 */
export const readSearchedList = <T>(
	path: string,
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	listOptions: ListQueryOptions,
	{ search, textsOf, headers }: ListSearch<T>
) => {
	const query = (pageNumber: number, take: number) =>
		buildListQuery(defaultParams, where, { ...listOptions, page: pageNumber, limit: take });
	const keep = searchingIn(search, textsOf);
	return readListPage(path, query, { page: listOptions.page, limit: listOptions.limit, keep, headers });
};

/** The text a search of a row's name reads. */
export const nameTexts = ({ name }: { name?: string }): unknown[] => [name];

/** A row with a name, a code and an email, as far as a search reads it. */
interface NamedRow {
	name?: string;
	code?: string;
	email?: string;
}

/** The texts a search of a row's name, code or email reads. */
export const nameCodeEmailTexts = ({ name, code, email }: NamedRow): unknown[] => [name, code, email];
