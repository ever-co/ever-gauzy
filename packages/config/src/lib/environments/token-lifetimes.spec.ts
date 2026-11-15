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

/**
 * The number a manifest gives a variable: the whole `value` on the line after its name, bare or between a pair of
 * quotes. Null when the manifest does not set it, or sets something that is not a whole number of seconds.
 */
function manifestValueIn(manifest: string, name: string): number | null {
	// `\r?` twice: a checkout may end its lines with CRLF
	const entry = new RegExp(`(?:name|key): ${name}[ \\t]*\\r?\\n[ \\t]*value: (['"]?)(\\d+)\\1[ \\t]*\\r?$`, 'm').exec(
		manifest
	);
	return entry ? Number(entry[2]) : null;
}

const manifestValue = (file: string, name: string) => manifestValueIn(read(file), name);

describe('the value a manifest gives a variable', () => {
	it.each([
		['bare', '- key: LIFETIME\n  value: 604800\n', 604800],
		['between single quotes', "- name: LIFETIME\n  value: '604800'\n", 604800],
		['between double quotes', '- name: LIFETIME\n  value: "604800"\n', 604800],
		['in a file whose lines end with CRLF', "- name: LIFETIME\r\n  value: '604800'\r\n", 604800],
		['at the end of the file', '- key: LIFETIME\n  value: 604800', 604800]
	])('is read %s', (_case, manifest, value) => {
		expect(manifestValueIn(manifest, 'LIFETIME')).toBe(value);
	});

	it.each([
		['goes on after the digits', '- key: LIFETIME\n  value: 604800e3\n'],
		['is a fraction', '- key: LIFETIME\n  value: 604800.5\n'],
		['has one quote of a pair', "- name: LIFETIME\n  value: '604800\n"],
		['has quotes that differ', '- name: LIFETIME\n  value: \'604800"\n'],
		['belongs to another variable', '- key: OTHER\n  value: 604800\n']
	])('is not read from a value that %s', (_case, manifest) => {
		expect(manifestValueIn(manifest, 'LIFETIME')).toBeNull();
	});
});

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

	it.each(DEMO_DEPLOYMENTS)('outlives the access token in the demo deployment %s', (manifest) => {
		const accessLifetime = manifestValue(manifest, 'JWT_TOKEN_EXPIRATION_TIME') ?? DEFAULT_ACCESS_TOKEN_LIFETIME_S;

		expect(manifestValue(manifest, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBeGreaterThan(accessLifetime);
	});

	it('is checked again by Nx whenever one of those files changes', () => {
		// They are outside the project, so a cached run of its tests would otherwise pass for a file it never read
		const { inputs } = JSON.parse(read('packages/config/project.json')).targets.test;

		expect(inputs).toEqual(
			expect.arrayContaining([...SAMPLES, ...DEMO_DEPLOYMENTS].map((file) => `{workspaceRoot}/${file}`))
		);
	});
});
