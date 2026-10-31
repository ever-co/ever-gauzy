import { ID } from '@gauzy/contracts';

/** What the project selector knows once a project list has loaded. */
export interface UrlProjectContext {
	/** The project the page's URL names (`?projectId=`), if any. */
	urlProjectId: ID | null | undefined;
	/** The project ID, or IDs, bound to the selector now. */
	selected: ID | ID[] | null | undefined;
	/** Whether the selector is a form field rather than the page's global filter. */
	skipGlobalChange: boolean;
	/** Whether this is the selector's first list, rather than a reload for another client or employee. */
	isFirstLoad: boolean;
}

/**
 * Whether the project selector should pick the project the page's URL names once its list has loaded.
 *
 * A global selector (the header's) mirrors the URL, so it always does. A form's selector
 * (`skipGlobalChange`) takes the URL's project only as its starting value: on its first list, and only
 * when nothing is selected in it yet. Its list also reloads whenever the form narrows it to another
 * client or employee. Such a reload must not swap the project picked in the form, or the one a task
 * being edited already has, for the page's. Nor may it put the page's project back after the form's
 * project was cleared.
 */
export function shouldSelectUrlProject({
	urlProjectId,
	selected,
	skipGlobalChange,
	isFirstLoad
}: UrlProjectContext): boolean {
	if (!urlProjectId) {
		return false;
	}
	if (!skipGlobalChange) {
		return true;
	}
	return isFirstLoad && !([] as ID[]).concat(selected ?? []).some(Boolean);
}
