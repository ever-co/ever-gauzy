import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { EverWorksUiService } from './ever-works.service';

/** Attempts after a temporary failure, and the first delay (doubled each time: 5 s … 80 s). */
export const EVER_WORKS_INBOX_AVAILABILITY_RETRIES = 5;
export const EVER_WORKS_INBOX_AVAILABILITY_RETRY_MS = 5_000;

/** A refusal that retrying does not change (404: the plugin is off; 401 / 403: not for this user). */
function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

/**
 * Whether the signed-in user can choose which of their Gauzy Inbox items go to Ever Works (Settings → Ever Works
 * inbox): `GET /api/integration/ever-works/me/inbox-preferences` answered, asked once per user. The route exists only
 * where the API loads the Ever Works plugin (`EVER_WORKS_ENABLED=true`) and answers only users with `INBOX_VIEW`;
 * elsewhere (404, 403: the default) the Settings menu looks exactly as before. A temporary failure (5xx, network) is
 * retried with a growing delay; signing out is `false` at once and drops a request still in flight.
 */
@Injectable({ providedIn: 'root' })
export class EverWorksInboxAvailabilityService {
	private readonly store = inject(Store);
	private readonly api = inject(EverWorksUiService);

	readonly available$: Observable<boolean> = this.store.user$.pipe(
		map((user: IUser | null | undefined) => user?.id ?? null),
		distinctUntilChanged(),
		switchMap((userId) =>
			!userId
				? of(false)
				: // `defer`: every retry sends the request again.
					defer(() => this.api.inboxPreferences()).pipe(
						retry({
							count: EVER_WORKS_INBOX_AVAILABILITY_RETRIES,
							delay: (error: HttpErrorResponse, attempt: number) =>
								isFinalRefusal(error)
									? throwError(() => error)
									: timer(EVER_WORKS_INBOX_AVAILABILITY_RETRY_MS * 2 ** (attempt - 1))
						}),
						map(() => true),
						catchError((_error: HttpErrorResponse) => of(false))
					)
		),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
