import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/** What the full-width record page is showing. */
export type RecordViewPageState = 'loading' | 'ready' | 'not-found' | 'forbidden' | 'error';

/**
 * The page state a failed record load maps to. A missing record (404) and an id that is not one (400 —
 * the API validates UUIDs) both read "not found"; 401/403 "no permission"; anything else is a load error
 * the viewer can retry.
 */
export function recordViewPageStateOf(error: unknown): RecordViewPageState {
	const status = error instanceof HttpErrorResponse ? error.status : (error as { status?: number })?.status;
	switch (status) {
		case 400:
		case 404:
			return 'not-found';
		case 401:
		case 403:
			return 'forbidden';
		default:
			return 'error';
	}
}

/**
 * The full-width, routed "View" page of one record (handover §4.P): the same `ngx-record-view` the
 * right-side drawer shows for a quick look, given the whole content area and a URL of its own, so it can
 * be bookmarked, shared, reloaded — and opened from a sidebar favorite.
 *
 * Presentational only: the routed page that hosts it loads the record and owns `state`. The projected
 * record view is the page's content; `[recordPageActions]` content (e.g. the favorite star) sits in the
 * header next to the title.
 */
@Component({
	selector: 'ngx-record-view-page',
	templateUrl: './record-view-page.component.html',
	styleUrls: ['./record-view-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class RecordViewPageComponent {
	/** i18n key (or literal) for the page heading — the record type, e.g. `TASKS_PAGE.HEADER`. */
	@Input() heading: string;
	/** Free text under the heading — typically the record's own name. */
	@Input() subtitle: string;
	/** The list the record belongs to, for the back button. */
	@Input() backLink: string | null = null;
	@Input() state: RecordViewPageState = 'loading';

	/** The viewer asked to load the record again after a load error. */
	@Output() readonly retry = new EventEmitter<void>();
}
