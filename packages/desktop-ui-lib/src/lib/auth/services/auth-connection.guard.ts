import { inject, InjectionToken } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { selectPersistStateInit } from '@datorama/akita';
import { combineLatest, from, Observable, of, switchMap } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { GAUZY_ENV } from '../../constants';
import { PersistQuery, PersistState, ServerConnectionService } from '../../services';

/**
 * Represents the relevant server connection and authentication state for the guard.
 */
interface ConnectionState {
	serverConnection: number;
	userId: string | null;
}

/**
 * Configuration interface for the AuthConnectionGuard.
 */
export interface AuthConnectionGuardConfig {
	serverDownRoute: string;
	errorQueryParamKey: string;
	redirectReasonQueryParamKey: string;
	connectionStatusQueryParamKey: string;
	userIdQueryParamKey: string;
}

/**
 * Default configuration values for the AuthConnectionGuard.
 */
export const DEFAULT_AUTH_CONNECTION_GUARD_CONFIG: AuthConnectionGuardConfig = {
	serverDownRoute: '/server-down',
	errorQueryParamKey: 'guardError',
	redirectReasonQueryParamKey: 'reason',
	connectionStatusQueryParamKey: 'connStatus',
	userIdQueryParamKey: 'userIdPresent'
};

/**
 * InjectionToken for providing AuthConnectionGuard configuration.
 */
export const AUTH_CONNECTION_GUARD_CONFIG = new InjectionToken<AuthConnectionGuardConfig>(
	'AuthConnectionGuard Configuration',
	{
		providedIn: 'root',
		factory: () => DEFAULT_AUTH_CONNECTION_GUARD_CONFIG
	}
);

// Constants
const OFFLINE_STATUS = 0;
const ACCESS_DENIED_REASON = 'access_denied';
const GUARD_ERROR_REASON = 'guard_error';

/**
 * Guard that protects routes based on server connectivity and user authentication status.
 * Redirects to a configured route if the connection is down AND the user is not authenticated.
 */
export const authConnectionGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
	const router = inject(Router);
	const persistQuery = inject(PersistQuery);
	const config = inject(AUTH_CONNECTION_GUARD_CONFIG);
	const env = inject(GAUZY_ENV);
	const serverConnectionService = inject(ServerConnectionService);

	return from(serverConnectionService.checkServerConnection(env.API_BASE_URL)).pipe(
		switchMap((isConnected: boolean) =>
			getCurrentConnectionState(persistQuery).pipe(
				map((connectionState) =>
					handleConnectionState(isConnected, connectionState, state.url, router, config)
				),
				catchError((error) => handleError(error, state.url, router, config))
			)
		)
	);
};

function getCurrentConnectionState(persistQuery: PersistQuery): Observable<ConnectionState> {
	return combineLatest([persistQuery.select(mapToConnectionState), selectPersistStateInit()]).pipe(
		take(1),
		map(([state]) => state)
	);
}

function mapToConnectionState(state: PersistState): ConnectionState {
	return {
		serverConnection: state.serverConnection,
		userId: state.userId
	};
}

function handleConnectionState(
	isConnected: boolean,
	connectionState: ConnectionState,
	url: string,
	router: Router,
	config: AuthConnectionGuardConfig
): boolean | UrlTree {
	if (isConnected || isAccessAllowed(connectionState)) {
		console.log(`AuthConnectionGuard: Access GRANTED to ${url}`);
		return true;
	}

	console.warn('AuthConnectionGuard: Access DENIED to %s. Redirecting. State:', url, connectionState);
	return createRedirectUrlTree(url, connectionState, ACCESS_DENIED_REASON, router, config);
}

function isAccessAllowed(state: ConnectionState): boolean {
	const isConnected = state.serverConnection !== OFFLINE_STATUS;
	const isAuthenticated = Boolean(state.userId);

	// Allow access if EITHER connected OR authenticated (enables offline mode)
	return isConnected || isAuthenticated;
}

function handleError(
	error: unknown,
	url: string,
	router: Router,
	config: AuthConnectionGuardConfig
): Observable<UrlTree> {
	console.error('AuthConnectionGuard: Error during state check for %s. Redirecting.', url, error);
	return of(createErrorRedirectUrlTree(url, router, config));
}

function createRedirectUrlTree(
	originalUrl: string,
	state: ConnectionState,
	reason: string,
	router: Router,
	config: AuthConnectionGuardConfig
): UrlTree {
	return router.createUrlTree([config.serverDownRoute], {
		queryParams: {
			redirectUrl: originalUrl,
			[config.redirectReasonQueryParamKey]: reason,
			[config.connectionStatusQueryParamKey]: state.serverConnection,
			[config.userIdQueryParamKey]: Boolean(state.userId)
		}
	});
}

function createErrorRedirectUrlTree(originalUrl: string, router: Router, config: AuthConnectionGuardConfig): UrlTree {
	return router.createUrlTree([config.serverDownRoute], {
		queryParams: {
			redirectUrl: originalUrl,
			[config.redirectReasonQueryParamKey]: GUARD_ERROR_REASON,
			[config.errorQueryParamKey]: 'true'
		}
	});
}
