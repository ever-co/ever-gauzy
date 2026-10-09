/**
 * The anonymous usage statistics settings of the API a desktop app runs locally (Gauzy Desktop with
 * its integrated server, Gauzy Server, Gauzy API Server).
 *
 * - `EVER_INSTALL_SOURCE=desktop`: the report counts the installation as a desktop one. Applied
 *   after the user's additional settings, so it cannot be changed there.
 * - `GAUZY_APP_VERSION`: the release of the desktop app, so the report carries it (the API reads
 *   it; a desktop build sets nothing else).
 * - `EVER_STATS_ENABLED`: the settings field is free text, while the API switches the statistics
 *   off only for the exact value `false`. `false`, `off`, `no`, `0` and `disabled`, in any case and
 *   with spaces around, become `false`; `true`, `on`, `yes` and `1` become `true`; anything else is
 *   passed on unchanged (the API keeps the default, on, and logs a warning).
 *
 * @param additional - The user's additional settings (`LocalStore.getAdditionalConfig()`).
 * @param version - The release of the desktop app (`app.getVersion()`).
 */
/**
 * Applies {@link desktopStatsEnv} to `target` (the process environment of an integrated server): a
 * switch the user cleared in the settings is removed, so a value from an earlier start does not stay.
 */
export function applyDesktopStatsEnv(target: Record<string, string | undefined>, additional: object | null | undefined, version: string): void {
	const env = desktopStatsEnv(additional, version);
	if (!('EVER_STATS_ENABLED' in env) && additional && 'EVER_STATS_ENABLED' in additional) {
		delete target['EVER_STATS_ENABLED'];
	}
	Object.assign(target, env);
}

export function desktopStatsEnv(additional: object | null | undefined, version: string): Record<string, string> {
	const env: Record<string, string> = { EVER_INSTALL_SOURCE: 'desktop' };
	if (typeof version === 'string' && version.trim()) {
		env['GAUZY_APP_VERSION'] = version.trim();
	}
	const raw = (additional as Record<string, unknown> | null | undefined)?.['EVER_STATS_ENABLED'];
	if (typeof raw === 'string' && raw.trim() !== '') {
		const value = raw.trim().toLowerCase();
		if (['false', 'off', 'no', '0', 'disabled'].includes(value)) {
			env['EVER_STATS_ENABLED'] = 'false';
		} else if (['true', 'on', 'yes', '1'].includes(value)) {
			env['EVER_STATS_ENABLED'] = 'true';
		} else {
			env['EVER_STATS_ENABLED'] = raw;
		}
	}
	return env;
}
