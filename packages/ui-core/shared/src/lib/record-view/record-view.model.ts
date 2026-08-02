/**
 * Descriptor types for `ngx-record-view` — the shared read-only rendering of a
 * single record.
 *
 * The point of a descriptor list (rather than a bespoke template per entity) is
 * that every "View" surface in the app then renders the same way: same label
 * column, same empty-value handling, same tag/person/date renderers as the
 * grids the record was selected in.
 */

/**
 * Renderer to use for a value. `text` is the default.
 *
 * `tags`, `people`, `teams`, `money`, `badge` and the date types deliberately
 * delegate to the very same components the smart-table columns use, so a record
 * reads identically in the grid row and in its View.
 */
export type RecordViewFieldType =
	| 'text'
	| 'multiline'
	| 'html'
	| 'date'
	| 'datetime'
	| 'boolean'
	| 'money'
	| 'badge'
	| 'tags'
	| 'people'
	| 'person'
	| 'teams'
	| 'email'
	| 'phone'
	| 'link';

/**
 * A person as rendered by the `person` field type. Callers rarely build this by
 * hand — `RecordViewComponent` normalizes employees/users/contacts into it.
 */
export interface IRecordViewPerson {
	id?: string;
	name: string;
	imageUrl?: string;
}

export interface IRecordViewField {
	/** i18n key (or a literal, when there is no key) for the row label. */
	label: string;
	/** Dot path into the record, e.g. `approvalPolicy.name`. Ignored when `value` is set. */
	key?: string;
	/** Renderer for the value; defaults to `text`. */
	type?: RecordViewFieldType;
	/**
	 * Pre-computed value — wins over `key`. Use it for values the page already
	 * derives (a mapped status badge, a joined label, a translated enum).
	 */
	value?: any;
	/**
	 * Permission required for this row, checked with `ngxPermissionsOnly`.
	 *
	 * A field guard may only ever NARROW the record: the View action itself
	 * carries the record's own guard, and nothing here may widen it.
	 */
	permission?: string | string[];
	/** Keep the row when the value is empty. Off by default — blank rows are noise. */
	showWhenEmpty?: boolean;
	/** Put the value on its own line under the label (long text, HTML, people). */
	wide?: boolean;
	/** `link` rows: href to open. Falls back to the value itself. */
	href?: string;
}

export interface IRecordViewSection {
	/** i18n key (or literal) for the section heading; omit for an unlabelled block. */
	title?: string;
	fields: IRecordViewField[];
}

/**
 * Resolved row, built once per record change so the template never calls back
 * into the component.
 */
export interface IRecordViewRow {
	field: IRecordViewField;
	type: RecordViewFieldType;
	value: any;
	isEmpty: boolean;
	/** Stable host object for `ga-only-tags`, which reads `rowData.tags`. */
	tagsHost?: { tags: any[] };
	/** Normalized single person for the `person` renderer. */
	person?: IRecordViewPerson;
}

export interface IRecordViewSectionRows {
	title?: string;
	rows: IRecordViewRow[];
}
