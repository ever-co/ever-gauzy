import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Right-side drawer used as the "View" surface for the simpler records — the
 * ones whose whole story fits in a vertical list of fields and that do not
 * warrant their own page (a popup is the least preferred option of the three).
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
