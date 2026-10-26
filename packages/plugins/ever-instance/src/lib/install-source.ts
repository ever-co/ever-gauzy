/**
 * How this installation was deployed, as its operator declares it in `EVER_INSTALL_SOURCE`.
 *
 * It is never inferred: no hostname, cloud provider variable, payment key or file path is read to
 * guess it. Unset means `self-hosted`.
 */
export type InstallSource = 'cloud' | 'self-hosted' | 'ever.sh' | 'works_app' | 'desktop' | `partner:${string}`;

/** The values `EVER_INSTALL_SOURCE` accepts besides `partner:<slug>`. */
export const INSTALL_SOURCES: ReadonlyArray<InstallSource> = Object.freeze([
	'cloud',
	'self-hosted',
	'ever.sh',
	'works_app',
	'desktop'
]);

/** `partner:` followed by 2 to 32 lower-case letters, digits or dashes. */
const PARTNER = /^partner:[a-z0-9-]{2,32}$/;

/** The default when `EVER_INSTALL_SOURCE` is unset or not understood. */
export const DEFAULT_INSTALL_SOURCE: InstallSource = 'self-hosted';

/**
 * Reads `EVER_INSTALL_SOURCE` from `env`. Unset or blank gives `self-hosted`; a value that is not
 * one of {@link INSTALL_SOURCES} or `partner:<slug>` gives `self-hosted` and one call of `warn`,
 * which never repeats the value (it could be anything an operator typed).
 */
export function parseInstallSource(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): InstallSource {
	const raw = env['EVER_INSTALL_SOURCE'];
	if (raw === undefined || raw.trim() === '') {
		return DEFAULT_INSTALL_SOURCE;
	}
	const value = raw.trim();
	if ((INSTALL_SOURCES as ReadonlyArray<string>).includes(value) || PARTNER.test(value)) {
		return value as InstallSource;
	}
	warn(
		'EVER_INSTALL_SOURCE is not one of cloud, self-hosted, ever.sh, works_app, desktop or partner:<slug>; using self-hosted.'
	);
	return DEFAULT_INSTALL_SOURCE;
}

/** Whether the operator declared this installation as Ever's own cloud (`EVER_INSTALL_SOURCE=cloud`). */
export function isCloud(env: Record<string, string | undefined> = process.env): boolean {
	return parseInstallSource(env) === 'cloud';
}
