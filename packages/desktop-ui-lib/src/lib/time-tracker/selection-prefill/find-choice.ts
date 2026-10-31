import { firstValueFrom, Observable } from 'rxjs';

/** How many pages of a selector's list the prefill looks through for a choice of the last log (10 entries a page). */
export const MAX_PREFILL_PAGES = 5;

/** The part of a selector (`SelectorService`) the prefill looks through: its list, loaded a page at a time. */
export interface IPagedChoices<T> {
	/** Starts the list over: the next load answers its first page, filtered by the choices made so far. */
	resetPage(): void;
	/** Loads the current page into the list. A failure does not reject: it is recorded as the list's error. */
	load(): Promise<void>;
	/** The entries loaded so far. */
	getAll(): T[];
	/** Moves to the next page. */
	onScrollToEnd(): void;
	readonly selectorQuery: {
		readonly hasNext: boolean;
		/** The error of the last load, `null` once a load succeeds. */
		selectError(): Observable<unknown>;
	};
}

/** A selector's list could not be loaded: whether it offers the choice is unknown, which is not the same as missing. */
export class ChoiceListUnavailableError extends Error {
	constructor(readonly reason?: unknown) {
		super('A selector list could not be loaded');
		this.name = 'ChoiceListUnavailableError';
	}
}

/**
 * Finds the entry `id` in a selector's list the way the employee could pick it there: the list reloaded for the
 * choices made so far (a project's teams and tasks once the project is chosen), then page after page.
 *
 * The lists only offer what the employee may pick (their clients, projects, teams and tasks), so an entry found here
 * is one the employee can still track time on.
 *
 * @param options.maxPages how many pages to look through.
 * @param options.isCurrent whether the lookup is still wanted, read after each page: once it is not (another
 * organization, the timer started), no further page is loaded.
 * @returns the entry, or `null` when the list does not offer it within `maxPages` pages, or the lookup is no longer
 * wanted.
 * @throws ChoiceListUnavailableError when a page could not be loaded.
 */
export async function findChoice<T extends { id?: string }>(
	list: IPagedChoices<T>,
	id: string,
	{ maxPages = MAX_PREFILL_PAGES, isCurrent = () => true }: { maxPages?: number; isCurrent?: () => boolean } = {}
): Promise<T | null> {
	list.resetPage();
	for (let page = 1; ; page++) {
		await list.load();
		if (!isCurrent()) {
			return null;
		}
		const error = await firstValueFrom(list.selectorQuery.selectError());
		if (error) {
			throw new ChoiceListUnavailableError(error);
		}

		const entry = list.getAll().find((item) => item?.id === id);
		if (entry || page >= maxPages || !list.selectorQuery.hasNext) {
			return entry ?? null;
		}
		list.onScrollToEnd();
	}
}
