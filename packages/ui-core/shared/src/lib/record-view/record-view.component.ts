import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { ISelectedEmployee } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import {
	IRecordViewField,
	IRecordViewPerson,
	IRecordViewRow,
	IRecordViewSection,
	IRecordViewSectionRows,
	RecordViewFieldType
} from './record-view.model';
import { richTextToHtml } from './record-view-markdown';

/** Seeded / generated avatar placeholders: a grey silhouette, or a letter on black. */
const PLACEHOLDER_AVATAR = /avatar-default\.svg|dummyimage\.com/i;

/**
 * Read-only rendering of one record as label/value pairs, driven by a field
 * descriptor list. It never edits; the only navigation it does on its own is
 * the employee profile link on a person chip, same as the grid's people cells.
 *
 * @see IRecordViewField for the descriptor shape.
 */
@Component({
	selector: 'ngx-record-view',
	templateUrl: './record-view.component.html',
	styleUrls: ['./record-view.component.scss'],
	standalone: false
})
export class RecordViewComponent implements OnChanges {
	@Input() record: any;
	@Input() sections: IRecordViewSection[] = [];
	/** Shown for rows kept via `showWhenEmpty`. */
	@Input() placeholder = '—';

	public resolved: IRecordViewSectionRows[] = [];
	/** Indexes of the collapsible sections the viewer has folded. */
	public readonly collapsed = new Set<number>();
	/** Avatar URLs that failed to load — those people fall back to their initials. */
	public readonly brokenImages = new Set<string>();

	constructor(private readonly router: Router, private readonly store: Store) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['record'] || changes['sections']) {
			this.resolved = this.build();
		}
	}

	toggle(index: number): void {
		if (this.collapsed.has(index)) {
			this.collapsed.delete(index);
		} else {
			this.collapsed.add(index);
		}
	}

	/** Person chips built from an employee open that employee's profile. */
	openEmployee(person: IRecordViewPerson): void {
		const employee = person.employee;
		if (!employee?.id) {
			return;
		}
		this.store.selectedEmployee = {
			...employee,
			firstName: employee.user?.firstName,
			lastName: employee.user?.lastName,
			imageUrl: person.imageUrl
		} as ISelectedEmployee;
		this.router.navigate([`/pages/employees/edit/${employee.id}/account`]);
	}

	/**
	 * Resolve the descriptor against the record ONCE per change. The template is
	 * then free of method calls, which keeps object identities (the `ga-only-tags`
	 * host, the normalized people) stable across change detection.
	 */
	private build(): IRecordViewSectionRows[] {
		return (this.sections || [])
			.map((section: IRecordViewSection) => ({
				title: section.title,
				icon: section.icon,
				variant: section.variant || 'panel',
				collapsible: !!section.collapsible,
				rows: (section.fields || [])
					.map((field: IRecordViewField) => this.toRow(field))
					.filter((row: IRecordViewRow) => !row.isEmpty || !!row.field.showWhenEmpty)
			}))
			.filter((section: IRecordViewSectionRows) => section.rows.length > 0);
	}

	/**
	 * Build one row: resolve the value, decide whether it counts as empty, and
	 * pre-shape whatever the chosen renderer needs.
	 */
	private toRow(field: IRecordViewField): IRecordViewRow {
		const type: RecordViewFieldType = field.type || 'text';
		const value = field.value !== undefined ? field.value : this.resolve(field.key);
		const row: IRecordViewRow = { field, type, value, isEmpty: RecordViewComponent.isEmpty(value) };

		switch (type) {
			case 'tags':
				row.tagsHost = { tags: Array.isArray(value) ? value : [] };
				break;
			case 'person':
				row.person = RecordViewComponent.toPerson(value);
				row.isEmpty = !row.person;
				break;
			case 'people':
				row.people = (Array.isArray(value) ? value : []).map(RecordViewComponent.toPerson).filter(Boolean);
				row.isEmpty = row.people.length === 0;
				break;
			case 'teams':
				// Team objects or plain names — the two shapes the grid's teams cell accepts.
				row.teams = (Array.isArray(value) ? value : [])
					.map((team: any) =>
						typeof team === 'string'
							? { name: team, count: 0 }
							: { name: team?.name, count: team?.members?.length || 0 }
					)
					.filter((team) => !!team.name);
				row.isEmpty = row.teams.length === 0;
				break;
			case 'status':
				row.isEmpty = !value?.text;
				break;
			case 'markdown':
				row.html = richTextToHtml(value);
				row.isEmpty = !row.html;
				break;
		}

		return row;
	}

	/**
	 * Walks a dot path into the record. Returns `undefined` rather than throwing
	 * when an intermediate link is missing — a half-populated relation is normal
	 * for records loaded with a narrow `relations` list.
	 */
	private resolve(path: string | undefined): any {
		if (!path || !this.record) {
			return undefined;
		}
		return path
			.split('.')
			.reduce((acc: any, part: string) => (acc === null || acc === undefined ? acc : acc[part]), this.record);
	}

	/** `false` and `0` are values, not blanks — only null/undefined/''/[] are. */
	private static isEmpty(value: any): boolean {
		if (value === null || value === undefined || value === '') {
			return true;
		}
		return Array.isArray(value) && value.length === 0;
	}

	/**
	 * Accepts an employee, a user or a plain `{ name }` and flattens it to what
	 * the person renderers need, so callers do not have to know which of the
	 * three a given relation gives them.
	 */
	private static toPerson(value: any): IRecordViewPerson | undefined {
		if (!value) {
			return undefined;
		}
		const user = value.user || value;
		const name: string =
			value.fullName ||
			value.name ||
			[user.firstName, user.lastName].filter(Boolean).join(' ') ||
			user.name ||
			user.email;
		if (!name) {
			return undefined;
		}

		const imageUrl: string = value.imageUrl || user.imageUrl;
		const initials = name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part: string) => part[0].toUpperCase())
			.join('');

		return {
			id: value.id,
			name,
			// Placeholders read worse than coloured initials, so they count as no photo.
			imageUrl: imageUrl && !PLACEHOLDER_AVATAR.test(imageUrl) ? imageUrl : undefined,
			initials,
			hue: RecordViewComponent.hueOf(name),
			// An employee carries its user under `user`; a bare user does not.
			employee: value.user ? value : undefined
		};
	}

	/**
	 * A stable hue per name, so the same person always gets the same colour.
	 * Reducing mod 360 at every step keeps the running value small and exact.
	 */
	private static hueOf(name: string): number {
		let hue = 0;
		for (const char of name) {
			hue = (hue * 31 + char.codePointAt(0)) % 360;
		}
		return hue;
	}
}
