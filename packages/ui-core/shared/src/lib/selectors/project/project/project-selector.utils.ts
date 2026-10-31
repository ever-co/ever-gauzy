import { ID } from '@gauzy/contracts';

/**
 * Whether the project selector should pick the project the page's URL names (`?projectId=`) once its
 * list has loaded.
 *
 * A global selector (the header's) mirrors the URL, so it always does. A form's selector
 * (`skipGlobalChange`) takes the URL's project only as a starting value, while nothing is picked in it:
 * its list also reloads when the form narrows it to another client or employee, and that reload must not
 * swap the project picked in the form, or the one a task being edited already has, for the page's.
 *
 * @param urlProjectId The project the URL names, if any.
 * @param selected The project ID, or IDs, bound to the selector now.
 * @param skipGlobalChange Whether the selector is a form field rather than the page's global filter.
 */
export function shouldSelectUrlProject(
	urlProjectId: ID | null | undefined,
	selected: ID | ID[] | null | undefined,
	skipGlobalChange: boolean
): boolean {
	if (!urlProjectId) {
		return false;
	}
	if (!skipGlobalChange) {
		return true;
	}
	return !([] as ID[]).concat(selected ?? []).some(Boolean);
}
