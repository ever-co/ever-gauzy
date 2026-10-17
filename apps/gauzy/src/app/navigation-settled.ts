import { Event, NavigationCancel, NavigationCancellationCode, NavigationError, Router } from '@angular/router';
import { Observable, filter, map, mergeMap, timer } from 'rxjs';

/**
 * Whether a router event ends a navigation without handing over to another one (Q8d).
 *
 * An error, or a refusal (a guard that returned `false`, a resolver with no data, an abort), ends it there. A redirect
 * or a newer navigation does not: the navigation that replaces it ends in its own `NavigationEnd`.
 *
 * @param event A router event.
 * @returns True when nothing replaces the navigation the event ends.
 */
export function endsWithoutReplacement(event: Event): boolean {
	if (event instanceof NavigationError) {
		return true;
	}

	return (
		event instanceof NavigationCancel &&
		event.code !== NavigationCancellationCode.Redirect &&
		event.code !== NavigationCancellationCode.SupersededByNewNavigation
	);
}

/**
 * Emits when a navigation ends without a `NavigationEnd` and no other navigation follows it (Q8d).
 *
 * The app's loading skeleton waited for a `NavigationEnd` only, so a first navigation that failed or was refused left it
 * over an outlet that would never fill. The check runs after a macrotask, because a guard that refuses usually starts
 * the navigation it sends the user to first — and that navigation's own end is the one to wait for.
 *
 * @param router The router (its events and its pending navigation).
 * @returns The moments the router settled with nothing to show.
 */
export function unsettledNavigations(router: Pick<Router, 'events' | 'getCurrentNavigation'>): Observable<void> {
	return router.events.pipe(
		filter(endsWithoutReplacement),
		mergeMap(() => timer(0)),
		filter(() => !router.getCurrentNavigation()),
		map(() => undefined)
	);
}
