/**
 * Whether the real-time plugin is loaded. Off unless `GAUZY_REALTIME_ENABLED` is exactly `true`; unset,
 * empty and `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...) keeps it off and is
 * reported once through `warn`, which never repeats the value.
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds its plugin list. Same contract
 * as `isInboxEnabled` of `@gauzy/plugin-inbox`.
 */
export function isRealtimeEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_REALTIME_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_REALTIME_ENABLED is neither "true" nor "false"; the real-time channel stays off (the default).');
	return false;
}

/**
 * Whether the real-time plugin prunes the collaboration events it no longer needs to replay (`RealtimeRetentionService`).
 * Off unless `GAUZY_REALTIME_RETENTION_ENABLED` is exactly `true`, whatever `GAUZY_REALTIME_ENABLED` says: it deletes
 * outbox rows, so an installation turns it on deliberately (on production, only after checking its database's backups).
 * Any other value keeps it off and is reported through `warn`, which never repeats the value.
 */
export function isRealtimeRetentionEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_REALTIME_RETENTION_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_REALTIME_RETENTION_ENABLED is neither "true" nor "false"; the outbox retention stays off (the default).');
	return false;
}
