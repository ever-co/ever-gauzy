import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, Observable, of, throwError, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, shareReplay, switchMap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TaskAutomationsApiService } from './task-automations-api.service';

/** Attempts after a temporary failure, and the first delay (doubled each time: 5 s … 80 s). */
export const TASK_AUTOMATIONS_AVAILABILITY_RETRIES = 5;
export const TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS = 5_000;

/** A refusal that retrying does not change: the plugin is not loaded (404), or not for this user (401 / 403). */
export function isFinalRefusal(error: HttpErrorResponse | null | undefined): boolean {
	return error?.status === 404 || error?.status === 401 || error?.status === 403;
}

/**
 * Whether this installation's API serves task automations to the signed-in user: asked once per user (the
 * templates route). The API loads `@gauzy/plugin-task-automations` only when `GAUZY_TASK_AUTOMATIONS_ENABLED=true`;
 * elsewhere (the default) the route answers 404 and the app shows no Automations entry at all. A user without
 * `TASK_AUTOMATION_MANAGE` gets 403: the same.
 */
@Injectable({ providedIn: 'root' })
export class TaskAutomationsAvailabilityService {
	private readonly store = inject(Store);
	private readonly api = inject(TaskAutomationsApiService);

	/**
	 * `true` once the API answered the templates for the signed-in user. A refusal that will not change is `false` at
	 * once; a temporary failure (5xx, network) is retried with a growing delay, so an API that recovers after the app
	 * started still shows the entry; after the last attempt it is `false` until another user signs in. Signing out is
	 * `false` at once and cancels a request still in flight, so a late answer never applies to the next user.
	 */
	readonly available$: Observable<boolean> = this.store.user$.pipe(
		map((user: IUser | null | undefined) => user?.id ?? null),
		distinctUntilChanged(),
		switchMap((userId) =>
			!userId
				? of(false)
				: defer(() => this.api.templates()).pipe(
						retry({
							count: TASK_AUTOMATIONS_AVAILABILITY_RETRIES,
							delay: (error: HttpErrorResponse, attempt: number) =>
								isFinalRefusal(error)
									? throwError(() => error)
									: timer(TASK_AUTOMATIONS_AVAILABILITY_RETRY_MS * 2 ** (attempt - 1))
						}),
						map(() => true),
						catchError((_error: HttpErrorResponse) => of(false))
					)
		),
		shareReplay({ bufferSize: 1, refCount: false })
	);
}
