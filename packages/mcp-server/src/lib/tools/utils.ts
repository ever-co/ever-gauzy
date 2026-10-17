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
 * `query` builds the query of one page; `stop` ends the read before the rows run out.
 */
export const readAllPages = async <T>(
	path: string,
	query: (page: number, take: number) => Record<string, unknown>,
	stop?: (items: T[]) => boolean
): Promise<T[]> => {
	const take = 100;
	const items: T[] = [];

	for (let page = 1; ; page++) {
		const response = await apiClient.get<{ items?: T[]; total?: number }>(path, { params: query(page, take) });
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

/** Whether `text` contains `query`, ignoring case; no query matches everything. */
export const containsText = (text: unknown, query?: string): boolean => {
	const needle = query?.toLowerCase();
	const haystack = String(text ?? '').toLowerCase();
	return !needle || haystack.includes(needle);
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
