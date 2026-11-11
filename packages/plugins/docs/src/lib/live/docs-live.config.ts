/**
 * Configuration and machine codes of the live editing sessions (`docs-collaboration` plan, phase 3).
 *
 * Every variable is optional. Only `GAUZY_DOCS_LIVE_ENABLED=true` (exactly, as with the real-time channel) loads the
 * sessions at all; the limits apply once it does.
 */

/** `true` loads the live editing sessions (`DocsLivePlugin`). Off by default. */
export const ENV_GAUZY_DOCS_LIVE_ENABLED = 'GAUZY_DOCS_LIVE_ENABLED';
/** The most editors one page takes; the next ones open it read-only. */
export const ENV_GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE = 'GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE';
/** The most live sessions one user holds in one process (tabs and pages together). */
export const ENV_GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER = 'GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER';
/** The largest single edit an editor may send, in bytes. */
export const ENV_GAUZY_DOCS_LIVE_MAX_UPDATE_BYTES = 'GAUZY_DOCS_LIVE_MAX_UPDATE_BYTES';
/** How long the edits of a page wait before they are saved, in milliseconds after the last one. */
export const ENV_GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS = 'GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS';
/** The longest edits wait while editors keep typing, in milliseconds after the first unsaved one. */
export const ENV_GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS = 'GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS';
/** How often every open session's access is checked again, in seconds. */
export const ENV_GAUZY_DOCS_LIVE_RECHECK_SECONDS = 'GAUZY_DOCS_LIVE_RECHECK_SECONDS';

/** A session for this page and connection is not open in any process (it closed; the client opens a new one). */
export const DOCS_LIVE_SESSION_NOT_FOUND = 'DOCS_LIVE_SESSION_NOT_FOUND';
/** The session is read-only (no write access, a locked page, the page's editor limit): the edit is refused. */
export const DOCS_LIVE_READ_ONLY = 'DOCS_LIVE_READ_ONLY';
/** The edit is not a Yjs update (or an awareness update) this page can apply. */
export const DOCS_LIVE_UPDATE_INVALID = 'DOCS_LIVE_UPDATE_INVALID';
/** The edit, or the page with it, is over the size limit (`GAUZY_DOCS_LIVE_MAX_UPDATE_BYTES`, `GAUZY_DOCS_MAX_BINARY_BYTES`). */
export const DOCS_LIVE_TOO_LARGE = 'DOCS_LIVE_TOO_LARGE';
/** The user already holds `GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER` sessions here. */
export const DOCS_LIVE_USER_LIMIT = 'DOCS_LIVE_USER_LIMIT';
/** The connection id is not 8–64 letters, digits, `-` or `_`. */
export const DOCS_LIVE_CONNECTION_INVALID = 'DOCS_LIVE_CONNECTION_INVALID';

/**
 * Why a session is read-only or closed; the editor shows it.
 */
export enum DocumentLiveReasonEnum {
	/** The caller may read the page, not write it. */
	NO_WRITE_ACCESS = 'no_write_access',
	/** The page is locked (view-only until it is unlocked). */
	LOCKED = 'locked',
	/** The page has `GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE` editors already. */
	SESSION_LIMIT = 'session_limit',
	/** The page is at the size limit. */
	SIZE_LIMIT = 'size_limit',
	/** The caller may no longer read the page (a share revoked, a move, a team left). */
	ACCESS_REVOKED = 'access_revoked',
	/** The page was moved to the trash. */
	TRASHED = 'trashed',
	/** The same connection opened the page again. */
	REPLACED = 'replaced',
	/** The client did not read its stream, which was ended rather than left to grow. */
	OVERLOADED = 'overloaded',
	/** The process is shutting down; the client opens the session again (another process takes it). */
	SHUTDOWN = 'shutdown'
}

/** Typed view of the variables above. */
export interface IDocsLiveConfig {
	enabled: boolean;
	maxSessionsPerPage: number;
	maxSessionsPerUser: number;
	maxUpdateBytes: number;
	persistDebounceMs: number;
	persistMaxWaitMs: number;
	recheckSeconds: number;
}

const positiveInt = (env: NodeJS.ProcessEnv, key: string, fallback: number): number => {
	const parsed = Number.parseInt(String(env[key] ?? ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Whether the live editing sessions are on: `GAUZY_DOCS_LIVE_ENABLED` is exactly `true`.
 *
 * @param env The environment.
 */
export function isDocsLiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return String(env[ENV_GAUZY_DOCS_LIVE_ENABLED] ?? '').trim() === 'true';
}

/**
 * Reads the live session variables.
 *
 * @param env The environment.
 */
export function getDocsLiveConfig(env: NodeJS.ProcessEnv = process.env): IDocsLiveConfig {
	return {
		enabled: isDocsLiveEnabled(env),
		maxSessionsPerPage: positiveInt(env, ENV_GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE, 50),
		maxSessionsPerUser: positiveInt(env, ENV_GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER, 20),
		maxUpdateBytes: positiveInt(env, ENV_GAUZY_DOCS_LIVE_MAX_UPDATE_BYTES, 1024 * 1024),
		persistDebounceMs: positiveInt(env, ENV_GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS, 2000),
		persistMaxWaitMs: positiveInt(env, ENV_GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS, 10000),
		recheckSeconds: positiveInt(env, ENV_GAUZY_DOCS_LIVE_RECHECK_SECONDS, 60)
	};
}
