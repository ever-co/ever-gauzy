import type { AppLauncherListResponse } from '../launcher/launcher-items';

/** `GET /api/ever-connect/launcher/config`: what the web app needs to show the App Launcher in its header. */
export interface LauncherConfigResponse {
	/** The launcher is on (the route answers 404 otherwise). */
	enabled: true;
	/** This product's catalog id: its tile reads "You're here". */
	current: string;
	/** Ever Works' web app, where "Manage" leads. */
	worksAppUrl: string;
	/** The person has no Ever ID session that can read their apps: the launcher offers to sign in with Ever ID. */
	signInAvailable: boolean;
}

/** Why "Your apps" could not be read this time (a code only). */
export type LauncherWorksErrorCode = 'not_configured' | 'token_unavailable' | 'feed_refused' | 'feed_unavailable';

/**
 * `GET /api/ever-connect/launcher/apps?organizationId=`: the element's data (`items`, `meta`), plus whether to offer
 * signing in with Ever ID, and the section that could not be read (the element's `error`), if any. Never a token.
 */
export interface LauncherAppsResponse extends AppLauncherListResponse {
	signInAvailable: boolean;
	error: { section: 'works'; code: LauncherWorksErrorCode } | null;
}
