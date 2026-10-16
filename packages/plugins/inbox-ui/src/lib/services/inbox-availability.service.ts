import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { InboxUiService } from './inbox-ui.service';

/** Attempts after a temporary failure, and the first delay (doubled each time: 5 s … 80 s). */
export const INBOX_AVAILABILITY_RETRIES = 5;
export const INBOX_AVAILABILITY_RETRY_MS = 5_000;

/** A refusal that retrying does not change. */
export function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

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

	/**
	 * `true` once the API answered the counts for the signed-in user. A refusal that will not change (404: no
	 * Inbox; 401 / 403: not for this user) is `false` at once. A temporary failure (5xx, network) is retried
	 * with a growing delay, so an API that recovers after the app started still shows the Inbox; after the
	 * last attempt it is `false` until another user signs in.
	 */
	readonly available$: Observable<boolean> = this.store.user$.pipe(
		filter((user: IUser | null | undefined): user is IUser => !!user?.id),
		distinctUntilChanged((a, b) => a.id === b.id),
		switchMap(() =>
			// `defer`: every retry sends the request again.
			defer(() => this.api.counts()).pipe(
				retry({
					count: INBOX_AVAILABILITY_RETRIES,
					delay: (error: HttpErrorResponse, attempt: number) =>
						isFinalRefusal(error)
							? throwError(() => error)
							: timer(INBOX_AVAILABILITY_RETRY_MS * 2 ** (attempt - 1))
				}),
				map(() => true),
				catchError((_error: HttpErrorResponse) => of(false))
			)
		),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
