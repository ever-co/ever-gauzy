import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME } from './token-lifetimes';

/**
 * A refresh token renews a session only if it outlives the access token it is issued with (ever-co/ever-gauzy#11956).
 *
 * **The defect.** Every sample configuration and every demo deployment gave both tokens one day. They are issued
 * together, so they expired at the same second: someone who signed in at 09:00 and opened their laptop the next day
 * at 09:05 had no token left to renew the session with, and had to sign in again. The code meant otherwise (7 days
 * in the environment, 30 where the token is minted), and nothing said which of the three was intended.
 *
 * The files read here are the repository's own, as a deployment copies them.
 */

const REPOSITORY = join(__dirname, '../../../../..');

/** The access token lifetime without `JWT_TOKEN_EXPIRATION_TIME`, in seconds (`environment.ts`). */
const DEFAULT_ACCESS_TOKEN_LIFETIME_S = 86400;

const SAMPLES = ['.env.sample', '.env.compose', '.env.demo.compose', '.env.docker', '.env.local'];

const DEMO_DEPLOYMENTS = [
	'.deploy/k8s/k8s-manifest.demo.yaml',
	'.deploy/k8s/k8s-manifest.civo.demo.yaml',
	'.deploy/k8s/k8s-manifest.cw.demo.yaml',
	'.render/render.demo.yaml',
	'render.yaml'
];

const read = (file: string) => readFileSync(join(REPOSITORY, file), 'utf8');

/** The number a `NAME=123` line of an env file gives, or null when the file does not set it. */
function envValue(file: string, name: string): number | null {
	const line = new RegExp(`^${name}=(\\d+)\\s*$`, 'm').exec(read(file));
	return line ? Number(line[1]) : null;
}

/** The number a manifest gives a variable: its `value` on the line after its name. */
function manifestValue(file: string, name: string): number | null {
	const entry = new RegExp(`(?:name|key): ${name}\\s*\\n\\s*value: '?(\\d+)'?`).exec(read(file));
	return entry ? Number(entry[1]) : null;
}

describe('the refresh token lifetime', () => {
	it('outlives the access token by default', () => {
		expect(DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME).toBeGreaterThan(DEFAULT_ACCESS_TOKEN_LIFETIME_S);
	});

	it.each(SAMPLES)('is the code default in %s', (sample) => {
		expect(envValue(sample, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBe(DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME);
	});

	it.each(SAMPLES)('outlives the access token in %s', (sample) => {
		const accessLifetime = envValue(sample, 'JWT_TOKEN_EXPIRATION_TIME') ?? DEFAULT_ACCESS_TOKEN_LIFETIME_S;

		expect(envValue(sample, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBeGreaterThan(accessLifetime);
	});

	it.each(DEMO_DEPLOYMENTS)('is the code default in the demo deployment %s', (manifest) => {
		expect(manifestValue(manifest, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBe(
			DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME
		);
	});
});
