import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import {
	INBOX_AVAILABILITY_RETRIES,
	INBOX_AVAILABILITY_RETRY_MS,
	InboxAvailabilityService,
	isFinalRefusal
} from './inbox-availability.service';
import { InboxEmailSettingsService } from './inbox-email-settings.service';

/**
 * Whether this installation's API serves the Inbox **email** features (mailboxes, provider accounts) to the signed-in
 * user. Asked only where the Inbox itself is served (the same check the nav entry and the badge use,
 * {@link InboxAvailabilityService}), once per user: the `GET /api/inbox/mailboxes/mine` route, which the API has only
 * when `GAUZY_INBOX_EMAIL_ENABLED=true` loads the email features on top of the Inbox. A 404 there (the default) keeps
 * the Settings → Inbox entries and the "My mailbox" link away; 401 / 403 are final as well; a temporary failure is
 * retried like the Inbox check.
 */
@Injectable({ providedIn: 'root' })
export class InboxEmailAvailabilityService {
	private readonly inbox = inject(InboxAvailabilityService);
	private readonly api = inject(InboxEmailSettingsService);

	/**
	 * Follows the Inbox check: each of its answers (one per signed-in user) starts this check over, and `false` there is
	 * `false` here at once (cancelling a request in flight, so a late answer never applies to the next user).
	 */
	readonly available$: Observable<boolean> = this.inbox.available$.pipe(
		switchMap((inboxAvailable) =>
			!inboxAvailable
				? of(false)
				: defer(() => this.api.myMailboxes()).pipe(
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
