import { Component, EventEmitter, HostListener, Input, Output, ChangeDetectionStrategy } from '@angular/core';

/**
 * Right-side drawer used as the quick-look "View" surface of a record — the
 * whole story in a vertical list of fields, without leaving the list it was
 * opened from (a popup is the least preferred option of the three). A record
 * with a page of its own gets an expand icon to it (`fullViewLink`).
 *
 * Presentational only: the page owns the open state, which keeps the record it
 * is showing and the drawer's visibility from ever disagreeing.
 *
 * The panel stays in the DOM while closed. `<ng-content>` inside a conditional
 * block does NOT give a predictable create/destroy for projected content, so
 * callers gate their own content instead — see the usage in the pages, where
 * the projected `ngx-record-view` sits inside the page's own `@if`.
 */
@Component({
	selector: 'ngx-record-view-drawer',
	templateUrl: './record-view-drawer.component.html',
	styleUrls: ['./record-view-drawer.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class RecordViewDrawerComponent {
	@Input() open = false;
	/**
	 * i18n key (or literal) for the drawer heading.
	 *
	 * Named `heading` rather than `title` so a static binding does not also leave
	 * a native `title` attribute — and therefore a raw-i18n-key tooltip — on the host.
	 */
	@Input() heading: string;
	/** Free text under the heading — typically the record's own name. */
	@Input() subtitle: string;
	/** Roomier panel for records with long-form content (e.g. a task description). */
	@Input() wide = false;
	/**
	 * The record's own full-width page (a router path, e.g. `/pages/tasks/view/<id>`). When set, the
	 * header shows an "expand to full width" icon linking there — the drawer stays the quick look, the
	 * page is the bookmarkable, shareable view (handover §4.P). Omit it for a record with no page.
	 */
	@Input() fullViewLink: string | null = null;
	/**
	 * i18n key (or literal) spelled out beside the expand icon, for a page where going on to the record's
	 * own page is a step users look for (e.g. "Open task page"). Omit it for the icon alone.
	 */
	@Input() fullViewLabel: string | null = null;

	@Output() closed = new EventEmitter<void>();

	@HostListener('document:keydown.escape')
	onEscape(): void {
		if (this.open) {
			this.close();
		}
	}

	close(): void {
		this.closed.emit();
	}
}
