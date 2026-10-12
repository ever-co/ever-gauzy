import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-company-logo',
	templateUrl: './company-logo.component.html',
	styleUrls: ['./company-logo.component.scss'],
	standalone: false
})
export class CompanyLogoComponent {
	@Input() value: string | number;

	/** The Font Awesome classes for this row's glyph. Recomputed when the row changes. */
	iconClass: string = 'fab';

	private _rowData: any;

	@Input()
	set rowData(data: any) {
		this._rowData = data;
		this.iconClass = CompanyLogoComponent.toIconClass(data?.name);
	}
	get rowData(): any {
		return this._rowData;
	}

	/**
	 * Turns a company name into the brand class Font Awesome would know it by.
	 *
	 * The name used to be interpolated into the class list as it stood
	 * (`'fab fa-' + rowData?.name | lowercase`), which is only a class at all for a
	 * single-word name: "Ever Technologies LTD" produced THREE classes —
	 * `fa-ever`, `technologies` and `ltd` — so any company whose name happened to
	 * contain a word the page styles (`selected`, `primary`, `action`, `row`) was
	 * styled by it. A slug is one class whatever the name is: lower case, ASCII,
	 * hyphen separated, which is also the form Font Awesome's own names take, so
	 * "Pay Pal" now finds `fa-pay-pal` where before it looked for `fa-pay`.
	 *
	 * Names that match no brand keep the bare `fab`, and the stylesheet gives that
	 * element a generic glyph — see `--fa` there.
	 */
	private static toIconClass(name: unknown): string {
		// A name that is not a primitive is no name: `String()` would hand back
		// `[object Object]` and that slugs to a class of its very own.
		const raw = typeof name === 'string' || typeof name === 'number' ? `${name}` : '';
		const slug = raw
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			// One hyphen at either end is all there can be — the replace above has
			// already collapsed every run of non-alphanumerics into a single one — so
			// this needs no quantifier, and without one there is nothing to backtrack.
			.replace(/^-|-$/g, '');
		return slug ? `fab fa-${slug}` : 'fab';
	}
}
