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
	| 'markdown'
	| 'status'
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
	/** Shown when there is no real photo (placeholders count as none). */
	initials: string;
	/** Stable per-name hue for the initials avatar. */
	hue: number;
	/** The employee this person came from, when it was one — enables the profile link. */
	employee?: any;
}

/** Value of a `status` field: a coloured dot (or icon) in front of plain text. */
export interface IRecordViewStatus {
	text: string;
	/** Theme tone used when there is no explicit colour. */
	tone?: 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'basic';
	/** Tenant-defined colour, e.g. a task status row's own colour. Wins over `tone`. */
	color?: string;
	/** Eva icon in place of the dot, e.g. a priority arrow. */
	icon?: string;
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
	/** Eva icon shown before the label. */
	icon?: string;
	/** Hairline above this row — splits one section into groups (people / planning). */
	divider?: boolean;
	/** Colour the value, e.g. `danger` for an overdue date. */
	tone?: 'success' | 'danger' | 'warning' | 'info' | 'primary';
	/** Render the value alone, without its label (the section title already says it). */
	hideLabel?: boolean;
}

/**
 * How a section is drawn:
 * - `panel` (default): a bordered card; its title becomes the card header.
 * - `plain`: a heading followed by the content, no frame — long-form text.
 * - `meta`: small muted "label value" lines — created / updated stamps.
 */
export type RecordViewSectionVariant = 'panel' | 'plain' | 'meta';

export interface IRecordViewSection {
	/** i18n key (or literal) for the section heading; omit for an unlabelled block. */
	title?: string;
	/** Eva icon shown before the title. */
	icon?: string;
	variant?: RecordViewSectionVariant;
	/** Panel header toggles the section open / closed. */
	collapsible?: boolean;
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
	/** Normalized list for the `people` renderer. */
	people?: IRecordViewPerson[];
	/** Normalized list for the `teams` renderer. */
	teams?: { name: string; count: number }[];
	/** Rendered HTML for the `markdown` renderer. */
	html?: string;
}

export interface IRecordViewSectionRows {
	title?: string;
	icon?: string;
	variant: RecordViewSectionVariant;
	collapsible: boolean;
	rows: IRecordViewRow[];
}
