/** How many pages of a selector's list the prefill looks through for a choice of the last log (10 entries a page). */
export const MAX_PREFILL_PAGES = 5;

/** The part of a selector (`SelectorService`) the prefill looks through: its list, loaded a page at a time. */
export interface IPagedChoices<T> {
	/** Starts the list over: the next load answers its first page, filtered by the choices made so far. */
	resetPage(): void;
	/** Loads the current page into the list (a failure leaves the list as it is). */
	load(): Promise<void>;
	/** The entries loaded so far. */
	getAll(): T[];
	/** Moves to the next page. */
	onScrollToEnd(): void;
	readonly selectorQuery: { readonly hasNext: boolean };
}

/**
 * Finds the entry `id` in a selector's list the way the employee could pick it there: the list reloaded for the
 * choices made so far (a project's teams and tasks once the project is chosen), then page after page.
 *
 * The lists only offer what the employee may pick (their clients, projects, teams and tasks), so an entry found here
 * is one the employee can still track time on.
 *
 * @returns the entry, or `null` when the list does not offer it within `maxPages` pages.
 */
export async function findChoice<T extends { id?: string }>(
	list: IPagedChoices<T>,
	id: string,
	maxPages: number = MAX_PREFILL_PAGES
): Promise<T | null> {
	list.resetPage();
	for (let page = 1; ; page++) {
		await list.load();
		const entry = list.getAll().find((item) => item?.id === id);
		if (entry || page >= maxPages || !list.selectorQuery.hasNext) {
			return entry ?? null;
		}
		list.onScrollToEnd();
	}
}
