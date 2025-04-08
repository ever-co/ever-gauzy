import { Inject, Injectable, InjectionToken } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs'; // Added 'of' for catchError
import { catchError, map, take } from 'rxjs/operators'; // Removed distinctUntilChanged, filter from here as check is per-activation
import { PersistQuery } from '../../services'; // Assuming these paths are correct

/**
 * Represents the relevant server connection and authentication state for the guard.
 */
interface ConnectionState {
	serverConnection: number; // Represents connection status (e.g., 0 = down)
	userId: string | null; // Represents authentication status
}

/**
 * Configuration interface for the AuthConnectionGuard.
 */
export interface AuthConnectionGuardConfig {
	serverDownRoute: string; // Route to redirect to when server is down/unauthenticated
	errorQueryParamKey: string; // Query parameter key to indicate a guard check error
	redirectReasonQueryParamKey: string; // Query parameter key for why redirection happened
	connectionStatusQueryParamKey: string; // Query parameter key for connection status
	userIdQueryParamKey: string; // Query parameter key for user ID status
}

/**
 * Default configuration values for the AuthConnectionGuard.
 */
export const DEFAULT_AUTH_CONNECTION_GUARD_CONFIG: AuthConnectionGuardConfig = {
	serverDownRoute: '/server-down', // Example default route
	errorQueryParamKey: 'guardError', // Example default query param for errors
	redirectReasonQueryParamKey: 'reason', // Example key for redirection reason
	connectionStatusQueryParamKey: 'connStatus', // Example key for connection status
	userIdQueryParamKey: 'userIdPresent' // Example key for user ID presence
};

/**
 * InjectionToken for providing AuthConnectionGuard configuration.
 * Allows overriding default settings at the application level.
 */
export const AUTH_CONNECTION_GUARD_CONFIG = new InjectionToken<AuthConnectionGuardConfig>(
	'AuthConnectionGuard Configuration',
	{
		providedIn: 'root',
		factory: () => DEFAULT_AUTH_CONNECTION_GUARD_CONFIG // Provide the default config via factory
	}
);

/**
 * Guard that protects routes based on server connectivity and user authentication status.
 * It redirects to a configured route if the connection is down AND the user is not authenticated.
 * The check happens *during* the canActivate call using the current state.
 */
@Injectable({
	providedIn: 'root'
})
export class AuthConnectionGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		// private readonly store: Store, // Store might not be needed directly if PersistQuery provides all state
		private readonly persistQuery: PersistQuery,
		@Inject(AUTH_CONNECTION_GUARD_CONFIG) private readonly config: AuthConnectionGuardConfig
	) {
		// No complex subscription needed in the constructor anymore.
		// The check logic moves entirely into canActivate.
	}

	/**
	 * Determines if a route can be activated based on connection and authentication state *at the time of navigation*.
	 * @param route The activated route snapshot.
	 * @param state The router state snapshot.
	 * @returns An Observable emitting true (allow) or a UrlTree (redirect).
	 */
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
		return this.getCurrentConnectionState().pipe(
			map((connectionState) => {
				const isAllowed = this.isConnectionSufficient(connectionState);

				if (isAllowed) {
					console.log(`AuthConnectionGuard: Access GRANTED to ${state.url}`);
					return true; // Allow navigation
				} else {
					// If not allowed, redirect to the configured server down route
					console.warn(
						'AuthConnectionGuard: Access DENIED to %s. Redirecting. State:',
						state.url,
						connectionState
					);
					return this.createRedirectUrlTree(state.url, connectionState, 'access_denied');
				}
			}),
			catchError((error) => {
				// Handle potential errors during the state retrieval itself
				console.error('AuthConnectionGuard: Error during state check for %s. Redirecting.', state.url, error);
				// Redirect with a generic error indicator
				return of(this.createErrorRedirectUrlTree(state.url)); // Use 'of' to return Observable<UrlTree>
			})
		);
	}

	/**
	 * Retrieves the *current* connection and authentication state once.
	 * @returns An Observable emitting the current ConnectionState.
	 */
	private getCurrentConnectionState(): Observable<ConnectionState> {
		return this.persistQuery.select(this.mapToConnectionState).pipe(
			take(1) // Ensure we only take the *current* state for the canActivate check
			// Optional: Log state changes for debugging during activation
			// tap(currentState => console.log('AuthConnectionGuard Check State:', currentState)),
		);
	}

	/**
	 * Maps the relevant parts of the application state from PersistQuery.
	 * Ensures 'serverConnection' is treated as a number.
	 * Note: Ideally, the type should be consistent at the source (Store/PersistQuery).
	 */
	private mapToConnectionState = (state: any): ConnectionState => {
		// Consider adding stronger typing to the input 'state' if possible from PersistQuery
		// Defensive handling of potentially missing state properties
		const serverConnectionRaw = state?.serverConnection;
		const userIdRaw = state?.userId;

		return {
			serverConnection: typeof serverConnectionRaw === 'number' ? serverConnectionRaw : 0, // Default to 0 if not a number
			userId: typeof userIdRaw === 'string' && userIdRaw.length > 0 ? userIdRaw : null // Ensure it's a non-empty string or null
		};
	};

	/**
	 * Determines if the current state is sufficient for activation.
	 * Logic: Access is allowed if the server connection is NOT down (0) OR if a user ID exists.
	 */
	private isConnectionSufficient = (state: ConnectionState): boolean => {
		// Allow access if connection status is not 0 (assuming 0 means down/bad)
		// OR if a userId is present (user is authenticated)
		const connectionOk = state.serverConnection !== 0;
		const userAuthenticated = !!state.userId;

		return connectionOk || userAuthenticated;
	};

	/**
	 * Creates a UrlTree to redirect to the configured 'serverDownRoute'.
	 * Includes the original intended URL and context about the state causing redirection.
	 * @param originalUrl The URL the user was trying to access.
	 * @param state The ConnectionState that triggered the redirect.
	 * @param reason A code indicating why the redirection happened.
	 * @returns A UrlTree for redirection.
	 */
	private createRedirectUrlTree(originalUrl: string, state: ConnectionState, reason: string): UrlTree {
		return this.router.createUrlTree([this.config.serverDownRoute], {
			queryParams: {
				redirectUrl: originalUrl, // Include where the user was going
				[this.config.redirectReasonQueryParamKey]: reason,
				[this.config.connectionStatusQueryParamKey]: state.serverConnection,
				[this.config.userIdQueryParamKey]: !!state.userId // Indicate presence, not the actual ID
				// Add other relevant non-sensitive info if needed
			}
		});
	}

	/**
	 * Creates a UrlTree to redirect when an unexpected error occurs within the guard itself.
	 * Includes an error query parameter.
	 * @param originalUrl The URL the user was trying to access.
	 * @returns A UrlTree for redirection.
	 */
	private createErrorRedirectUrlTree(originalUrl: string): UrlTree {
		return this.router.createUrlTree([this.config.serverDownRoute], {
			queryParams: {
				redirectUrl: originalUrl,
				[this.config.redirectReasonQueryParamKey]: 'guard_error',
				[this.config.errorQueryParamKey]: 'true' // Use configured query parameter key
			}
		});
	}
}
