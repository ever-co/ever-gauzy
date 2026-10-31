import { IPersonChip } from '../project-view.utils';

/** One entry of a filter menu. */
export interface IBoardFilterOption {
	id: string;
	name: string;
}

/** What the filter reads off a board card. */
export interface IBoardFilterCard {
	key: string;
	title: string;
	people: IPersonChip[];
	priority?: string;
	type?: string;
	labels: IBoardFilterOption[];
}

/** What the viewer narrowed the board to. */
export interface IBoardFilter {
	search: string;
	/** Assignees by employee id, and `BOARD_UNASSIGNED` for the cards with none. */
	people: string[];
	priorities: string[];
	types: string[];
	labels: string[];
}

/** What the cards on the board offer to filter by. */
export interface IBoardFilterOptions {
	people: IPersonChip[];
	/** Some card has no assignee. */
	unassigned: boolean;
	priorities: IBoardFilterOption[];
	types: IBoardFilterOption[];
	labels: IBoardFilterOption[];
}

/** The filters read as a choice of several: the menus and the assignees, not the search. */
export type BoardFilterFacet = Exclude<keyof IBoardFilter, 'search'>;

export const BOARD_UNASSIGNED = 'unassigned';

export const NO_BOARD_FILTER: IBoardFilter = { search: '', people: [], priorities: [], types: [], labels: [] };

export const NO_BOARD_FILTER_OPTIONS: IBoardFilterOptions = {
	people: [],
	unassigned: false,
	priorities: [],
	types: [],
	labels: []
};

/** Most pressing first; a tenant's own priorities follow, by name. */
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

/** A priority or type as it is matched: tasks can carry "High" as a row's name and "high" as a bare value. */
const optionId = (name?: string): string => (name || '').trim().toLowerCase();

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

const priorityRank = (option: IBoardFilterOption): number => {
	const rank = PRIORITY_ORDER.indexOf(option.id);
	return rank < 0 ? PRIORITY_ORDER.length : rank;
};

/** The colour behind a person's initials: from their name, so they keep it. Dark enough to carry white text. */
export function boardAvatarColorOf(name: string): string {
	const hue = [...(name || '')].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) % 360, 0);
	return `hsl(${hue} 55% 34%)`;
}

export function isBoardFilterActive(filter: IBoardFilter): boolean {
	return (
		!!filter.search.trim() ||
		!!filter.people.length ||
		!!filter.priorities.length ||
		!!filter.types.length ||
		!!filter.labels.length
	);
}

/**
 * Whether a card stays on the board, as Jira's board filters read: any of the choices within a filter, and every
 * filter in use. The search takes a card's title or its key, with or without the `#` the task's header shows it with.
 */
export function matchesBoardFilter(card: IBoardFilterCard, filter: IBoardFilter): boolean {
	const search = filter.search.trim().replace(/^#/, '').toLowerCase();
	if (search && !`${card.title} ${card.key}`.toLowerCase().includes(search)) return false;
	if (filter.people.length) {
		const assigned = card.people.some((person) => filter.people.includes(person.id));
		const unassigned = !card.people.length && filter.people.includes(BOARD_UNASSIGNED);
		if (!assigned && !unassigned) return false;
	}
	if (filter.priorities.length && !filter.priorities.includes(optionId(card.priority))) return false;
	if (filter.types.length && !filter.types.includes(optionId(card.type))) return false;
	if (filter.labels.length && !card.labels.some((label) => filter.labels.includes(label.id))) return false;
	return true;
}

/** Each person, priority, type and label the cards carry, once. */
export function boardFilterOptionsOf(cards: IBoardFilterCard[]): IBoardFilterOptions {
	const people = new Map<string, IPersonChip>();
	const priorities = new Map<string, IBoardFilterOption>();
	const types = new Map<string, IBoardFilterOption>();
	const labels = new Map<string, IBoardFilterOption>();
	const add = (options: Map<string, IBoardFilterOption>, name?: string) => {
		const id = optionId(name);
		if (id && !options.has(id)) options.set(id, { id, name });
	};
	for (const card of cards) {
		card.people.forEach((person) => people.set(person.id, person));
		add(priorities, card.priority);
		add(types, card.type);
		card.labels.forEach((label) => labels.set(label.id, label));
	}
	return {
		people: [...people.values()].sort(byName),
		unassigned: cards.some((card) => !card.people.length),
		priorities: [...priorities.values()].sort((a, b) => priorityRank(a) - priorityRank(b) || byName(a, b)),
		types: [...types.values()].sort(byName),
		labels: [...labels.values()].sort(byName)
	};
}
