import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import {
	IRecordViewField,
	IRecordViewPerson,
	IRecordViewRow,
	IRecordViewSection,
	IRecordViewSectionRows,
	RecordViewFieldType
} from './record-view.model';

/**
 * Read-only rendering of one record as label/value pairs, driven by a field
 * descriptor list. It never edits and never navigates on its own.
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

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['record'] || changes['sections']) {
			this.resolved = this.build();
		}
	}

	/**
	 * Resolve the descriptor against the record ONCE per change. The template is
	 * then free of method calls, which keeps object identities (the `ga-only-tags`
	 * host, the normalized person) stable across change detection.
	 */
	private build(): IRecordViewSectionRows[] {
		return (this.sections || [])
			.map((section: IRecordViewSection) => ({
				title: section.title,
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

		if (type === 'tags') {
			row.tagsHost = { tags: Array.isArray(value) ? value : [] };
		} else if (type === 'person') {
			row.person = RecordViewComponent.toPerson(value);
			row.isEmpty = !row.person;
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
	 * the person renderer needs, so callers do not have to know which of the
	 * three a given relation gives them.
	 */
	private static toPerson(value: any): IRecordViewPerson | undefined {
		if (!value) {
			return undefined;
		}
		const user = value.user || value;
		const name =
			value.fullName ||
			value.name ||
			[user.firstName, user.lastName].filter(Boolean).join(' ') ||
			user.name ||
			user.email;

		return name ? { id: value.id, name, imageUrl: value.imageUrl || user.imageUrl } : undefined;
	}
}
