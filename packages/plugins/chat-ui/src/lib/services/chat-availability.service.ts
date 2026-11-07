import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ChatUiService } from './chat-ui.service';

export const CHAT_AVAILABILITY_RETRIES = 5;
export const CHAT_AVAILABILITY_RETRY_MS = 5_000;

/** 404 (the API does not load the chat), 401 and 403 (not this user) are final; anything else is retried. */
export function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

/**
 * Whether the API serves the chat to the signed-in user: asked once per sign-in (`GET /api/chat/states`), with a
 * growing delay on a temporary failure. The nav entry and the header badge follow it, so where the API does not
 * load `@gauzy/plugin-chat` (or the feature is off) the app looks exactly as before.
 */
@Injectable({ providedIn: 'root' })
export class ChatAvailabilityService {
	private readonly store = inject(Store);
	private readonly api = inject(ChatUiService);

	readonly available$: Observable<boolean> = this.store.user$.pipe(
		map((user: IUser | null | undefined) => user?.id ?? null),
		distinctUntilChanged(),
		switchMap((userId) =>
			!userId
				? of(false)
				: // `defer`: every retry sends the request again.
					defer(() => this.api.states()).pipe(
						retry({
							count: CHAT_AVAILABILITY_RETRIES,
							delay: (error: HttpErrorResponse, attempt: number) =>
								isFinalRefusal(error) ? throwError(() => error) : timer(CHAT_AVAILABILITY_RETRY_MS * 2 ** (attempt - 1))
						}),
						map(() => true),
						catchError((_error: HttpErrorResponse) => of(false))
					)
		),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
