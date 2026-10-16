import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, shareReplay, switchMap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { InboxUiService } from './inbox-ui.service';

/**
 * Whether this installation's API serves the Inbox to the signed-in user: asked once per user (the counts
 * route). The API loads `@gauzy/plugin-inbox` only when `GAUZY_INBOX_ENABLED=true`; elsewhere (the default,
 * production today) the route answers 404 and the app shows no Inbox entry and no badge at all. A user
 * without `INBOX_VIEW` gets 403: the same.
 */
@Injectable({ providedIn: 'root' })
export class InboxAvailabilityService {
	private readonly store = inject(Store);
	private readonly api = inject(InboxUiService);

	/** `true` once the API answered the counts for the signed-in user; `false` on any refusal. */
	readonly available$: Observable<boolean> = this.store.user$.pipe(
		filter((user: IUser | null | undefined): user is IUser => !!user?.id),
		distinctUntilChanged((a, b) => a.id === b.id),
		switchMap(() =>
			this.api.counts().pipe(
				map(() => true),
				catchError((_error: HttpErrorResponse) => of(false))
			)
		),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
