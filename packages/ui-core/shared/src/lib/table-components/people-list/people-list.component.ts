import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ID } from '@gauzy/contracts';

/**
 * A single person, normalized out of whatever shape the caller had.
 *
 * People reach the grid in three different shapes depending on the endpoint:
 * a plain `IEmployee` (with `user`), a join row (`{ employee, isManager }`),
 * or a bare `{ name, imageUrl }`. Normalizing once here is what lets a single
 * template render all of them.
 */
export interface IPersonListItem {
	/** Unique per rendered list — `@for` needs a stable, collision-free track key. */
	key: string;
	/** Employee id, when we have one. `null` means "not clickable". */
	id: ID | null;
	name: string;
	initials: string;
	imageUrl: string | null;
	/** The object we were handed, so the caller keeps its own navigation logic. */
	raw: any;
}

/**
 * The shared treatment for "several people in one grid cell".
 *
 * Renders a single-line horizontal group: the first `maxNames` people as a
 * small round avatar with their name beside it, everything after that as
 * avatar-only, and whatever still does not fit as a `+N` chip. Nothing here
 * has a box or a border of its own, and names truncate on available WIDTH
 * rather than on a character count, so a short name always renders in full.
 *
 * All metrics come from the `gauzy-people-*` tokens in the shared
 * `$gauzy-density` map (`themes.scss`), so the group stays in step with table
 * density and works in all registered themes.
 */
@Component({
	selector: 'ngx-people-list',
	templateUrl: './people-list.component.html',
	styleUrls: ['./people-list.component.scss'],
	standalone: false
})
export class PeopleListComponent {
	/** People rendered with their name next to the avatar. */
	public named: IPersonListItem[] = [];
	/** People rendered as an avatar only, after the named ones. */
	public stacked: IPersonListItem[] = [];
	/** People that did not fit at all — surfaced through the `+N` chip. */
	public overflow: IPersonListItem[] = [];

	private _items: IPersonListItem[] = [];
	private _maxNames = 2;
	private _maxAvatars = 3;

	/**
	 * The people to render. Accepts an array (or a single object) of employees,
	 * member join rows, or `{ name, imageUrl }` records.
	 */
	@Input() set people(value: any) {
		this._items = PeopleListComponent.normalize(value);
		this.split();
	}

	/** How many people get their name shown before the group falls back to avatars. */
	@Input() set maxNames(value: number) {
		this._maxNames = Math.max(1, Number(value) || 1);
		this.split();
	}
	get maxNames(): number {
		return this._maxNames;
	}

	/** How many avatar-only people are shown after the named ones. */
	@Input() set maxAvatars(value: number) {
		this._maxAvatars = Math.max(0, Number(value) || 0);
		this.split();
	}
	get maxAvatars(): number {
		return this._maxAvatars;
	}

	/**
	 * Allow the group to wrap onto several lines. Off inside data grids (a cell
	 * must cost the row one line box), on inside cards, where there is room.
	 */
	@Input() wrap: boolean = false;

	/** Emitted when a person is activated. Empty for people without an id. */
	@Output() readonly selectPerson = new EventEmitter<IPersonListItem>();

	/** Total number of people handed to the component. */
	get total(): number {
		return this._items.length;
	}

	/** How many people the `+N` chip stands for. */
	get overflowCount(): number {
		return this.overflow.length;
	}

	/** Tooltip for the `+N` chip: the names it is hiding. */
	get overflowNames(): string {
		return this.overflow.map((person) => person.name).join(', ');
	}

	/**
	 * Activates a person, unless they have no employee page to open.
	 *
	 * @param person The person that was clicked.
	 */
	onSelect(person: IPersonListItem): void {
		if (!person?.id) {
			return;
		}
		this.selectPerson.emit(person);
	}

	/**
	 * Falls back to the initials bubble when an avatar image fails to load.
	 * Employee image URLs routinely outlive the file they point at, and a broken
	 * image icon is worse than initials.
	 *
	 * @param person The person whose image failed to load.
	 */
	onImageError(person: IPersonListItem): void {
		person.imageUrl = null;
	}

	/**
	 * Splits the normalized people into the named / avatar-only / overflow buckets.
	 *
	 * Up to `maxNames` people keep their name. Past that only the first person
	 * does, so a row always shows at least one name, and the rest collapse into
	 * avatars plus a `+N` chip.
	 */
	private split(): void {
		const items = this._items;

		if (items.length <= this._maxNames) {
			this.named = items;
			this.stacked = [];
			this.overflow = [];
			return;
		}

		this.named = items.slice(0, 1);
		const rest = items.slice(1);
		this.stacked = rest.slice(0, this._maxAvatars);
		this.overflow = rest.slice(this._maxAvatars);
	}

	/**
	 * Normalizes an arbitrary collection of people into renderable items.
	 *
	 * @param value An array (or single object) of employees / member join rows.
	 * @returns The renderable items, skipping anything we cannot name.
	 */
	private static normalize(value: any): IPersonListItem[] {
		const source: any[] = Array.isArray(value) ? value : value ? [value] : [];
		const items: IPersonListItem[] = [];

		source.forEach((entry: any, index: number) => {
			const item = PeopleListComponent.toItem(entry, index);
			if (item) {
				items.push(item);
			}
		});

		return items;
	}

	/**
	 * Builds a single renderable item out of one entry.
	 *
	 * @param entry An employee, a member join row, or a `{ name, imageUrl }` record.
	 * @param index Position in the source collection, used to keep track keys unique.
	 * @returns The item, or `null` when the entry carries no name to show.
	 */
	private static toItem(entry: any, index: number): IPersonListItem | null {
		if (!entry) {
			return null;
		}

		// Some callers hand us bare display names rather than records.
		if (typeof entry === 'string') {
			const label = entry.trim();
			return label
				? {
						key: `${label}-${index}`,
						id: null,
						name: label,
						initials: PeopleListComponent.toInitials(label),
						imageUrl: null,
						raw: entry
				  }
				: null;
		}

		// Member collections sometimes hand us the join row rather than the employee.
		const employee = entry.employee ?? entry;
		const user = employee?.user ?? entry?.user ?? null;

		const name = (
			[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
			employee?.fullName ||
			user?.name ||
			employee?.name ||
			''
		).trim();

		if (!name) {
			return null;
		}

		const imageUrl = user?.imageUrl || user?.image?.fullUrl || employee?.imageUrl || null;
		const id = employee?.id ?? null;

		return {
			key: `${id ?? name}-${index}`,
			id,
			name,
			initials: PeopleListComponent.toInitials(name),
			imageUrl,
			raw: employee
		};
	}

	/**
	 * Derives the initials bubble shown when a person has no avatar image.
	 *
	 * @param name The person's display name.
	 * @returns One or two uppercase letters.
	 */
	private static toInitials(name: string): string {
		const parts = name.split(/\s+/).filter(Boolean);
		const first = parts[0]?.charAt(0) ?? '';
		const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
		return `${first}${last}`.toUpperCase();
	}
}
