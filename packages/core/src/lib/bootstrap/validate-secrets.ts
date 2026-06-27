import * as chalk from 'chalk';
import { environment } from '@gauzy/config';

/**
 * Known default/placeholder secret values shipped in the repository. Running a real deployment with
 * any of these is unsafe: the values are public, so anyone can forge authentication tokens and
 * sessions and impersonate any user (GHSA-chm8-2ggf-pgjq).
 */
const KNOWN_DEFAULT_SECRETS: ReadonlyArray<{ key: string; value: string }> = [
	{ key: 'JWT_SECRET', value: 'secretKey' },
	{ key: 'JWT_REFRESH_TOKEN_SECRET', value: 'refreshSecretKey' },
	{ key: 'JWT_VERIFICATION_TOKEN_SECRET', value: 'verificationSecretKey' },
	{ key: 'EXPRESS_SESSION_SECRET', value: 'gauzy' }
];

/**
 * Validates that the authentication/session secrets are not unset or left at their well-known
 * default values.
 *
 * - Always logs a prominent warning when weak secrets are detected (any environment).
 * - Additionally refuses to start in a real production deployment (`NODE_ENV=production` and
 *   `DEMO !== 'true'`), unless the operator explicitly opts out via `ALLOW_INSECURE_JWT_SECRET=true`.
 *
 * The daily-reset demo (`DEMO=true`) and local development are intentionally exempted from the hard
 * failure so they keep working out of the box, while still being warned.
 *
 * @throws Error in production (non-demo) when weak secrets are detected and the override is not set.
 */
export function validateApplicationSecrets(): void {
	const env = environment as unknown as Record<string, unknown>;

	const weak = KNOWN_DEFAULT_SECRETS.filter(({ key, value }) => {
		const current = (env[key] as string) ?? process.env[key];
		return !current || current === value;
	}).map(({ key }) => key);

	if (weak.length === 0) {
		return;
	}

	const guidance =
		'Generate strong, unique values (e.g. `openssl rand -hex 64`) and provide them via environment ' +
		'variables before deploying. Default/empty secrets let anyone forge authentication tokens and sessions.';

	// eslint-disable-next-line no-console
	console.error(chalk.bgRed.whiteBright.bold(` INSECURE SECRETS: ${weak.join(', ')} `));
	// eslint-disable-next-line no-console
	console.error(chalk.red(guidance));

	const isProduction = environment.production === true;
	const isDemo = process.env.DEMO === 'true';

	if (isProduction && !isDemo) {
		if (process.env.ALLOW_INSECURE_JWT_SECRET === 'true') {
			// eslint-disable-next-line no-console
			console.error(
				chalk.red(
					'Continuing despite insecure secrets because ALLOW_INSECURE_JWT_SECRET=true. This is STRONGLY discouraged.'
				)
			);
			return;
		}
		throw new Error(
			`Refusing to start: ${weak.join(', ')} ${weak.length === 1 ? 'is' : 'are'} unset or use a ` +
				`well-known default value in a production deployment. ${guidance} ` +
				'(To override temporarily, set ALLOW_INSECURE_JWT_SECRET=true — not recommended.)'
		);
	}
}
