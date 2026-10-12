/**
 * Whether the anonymous usage statistics plugin is loaded. Unset means on; only the exact value
 * `false` switches it off. Any other value keeps the default (on) and is reported once through
 * `warn`, which never repeats the value (it could be anything an operator typed).
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds the plugin list.
 */
export function isEverStatsEnabled(env: Record<string, string | undefined> = process.env, warn: (message: string) => void = () => undefined): boolean {
	const raw = env['EVER_STATS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'true') {
		return true;
	}
	if (raw === 'false') {
		return false;
	}
	warn('EVER_STATS_ENABLED is neither "true" nor "false"; the anonymous usage statistics stay on (the default).');
	return true;
}
