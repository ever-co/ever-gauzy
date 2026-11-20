import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { EverConnectUiService } from './ever-connect.service';

/** Attempts after a temporary failure, and the first delay (doubled each time: 5 s to 80 s). */
export const EVER_PLATFORM_MENU_RETRIES = 5;
export const EVER_PLATFORM_MENU_RETRY_MS = 5_000;

/** A refusal that retrying does not change (404: not loaded, or not the operator; 401 / 403: not for this user). */
function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

/**
 * Whether the signed-in user gets the Ever Platform menu entry: the API's menu probe
 * (`GET /api/ever-connect/probe`) answered, asked once per user. It answers only where the module is loaded
 * (`EVER_CONNECT_ENABLED=true`) and only the operator of the installation's connection; everywhere else (404, the
 * default) the menu looks exactly as before. A temporary failure (5xx, network) is retried with a growing delay;
 * signing out, or another user signing in, is `false` at once and drops a request still in flight.
 */
@Injectable({ providedIn: 'root' })
export class EverPlatformMenuService {
	private readonly store = inject(Store);
	private readonly api = inject(EverConnectUiService);

	readonly available$: Observable<boolean> = this.store.user$.pipe(
		map((user: IUser | null | undefined) => user?.id ?? null),
		distinctUntilChanged(),
		switchMap((userId) =>
			!userId
				? of(false)
				: // `defer`: every retry sends the request again.
					defer(() => this.api.probe()).pipe(
						retry({
							count: EVER_PLATFORM_MENU_RETRIES,
							delay: (error: HttpErrorResponse, attempt: number) =>
								isFinalRefusal(error)
									? throwError(() => error)
									: timer(EVER_PLATFORM_MENU_RETRY_MS * 2 ** (attempt - 1))
						}),
						map((probe) => probe?.loaded === true),
						catchError(() => of(false)),
						// Another user: hidden at once, until the probe answered for them.
						startWith(false)
					)
		),
		distinctUntilChanged(),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
