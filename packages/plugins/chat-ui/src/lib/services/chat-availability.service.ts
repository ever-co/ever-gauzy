import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { combineLatest, defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IOrganization, IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ChatUiService } from './chat-ui.service';

export const CHAT_AVAILABILITY_RETRIES = 5;
export const CHAT_AVAILABILITY_RETRY_MS = 5_000;

/** 404 (the API does not load the chat), 401 and 403 (not this user) are final; anything else is retried. */
export function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

/** The scope the chat is asked for: the signed-in user in the selected organization. */
export interface ChatScope {
	userId: string;
	organizationId: string | null;
}

/**
 * Whether the API serves the chat to the signed-in user in the selected organization: asked once per scope
 * (`GET /api/chat/states`), with a growing delay on a temporary failure, and again when the user or the
 * organization changes. The nav entry and the header badge follow it, so where the API does not load
 * `@gauzy/plugin-chat` (or the feature is off for the tenant) the app looks exactly as before.
 */
@Injectable({ providedIn: 'root' })
export class ChatAvailabilityService {
	private readonly store = inject(Store);
	private readonly api = inject(ChatUiService);

	/** The current scope, or null before sign-in. */
	readonly scope$: Observable<ChatScope | null> = combineLatest([
		this.store.user$ as Observable<IUser | null | undefined>,
		this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>
	]).pipe(
		map(([user, organization]) => (user?.id ? { userId: String(user.id), organizationId: organization?.id ? String(organization.id) : null } : null)),
		distinctUntilChanged((a, b) => a?.userId === b?.userId && a?.organizationId === b?.organizationId),
		shareReplay({ bufferSize: 1, refCount: false })
	);

	readonly available$: Observable<boolean> = this.scope$.pipe(
		switchMap((scope) =>
			!scope
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
