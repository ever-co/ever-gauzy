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
	'render.yaml',
	'.fly/applications/api/fly.toml'
];

const read = (file: string) => readFileSync(join(REPOSITORY, file), 'utf8');

/**
 * A value as a whole number of seconds, bare or between a pair of quotes. Null when it is empty (the API then takes
 * the code default); NaN when it is something else, so that a value the API would read its own way (`parseInt` takes
 * `604800e3` as 604800) fails a comparison instead of being taken for an unset one.
 */
function seconds(value: string): number | null {
	if (/^(['"]?)\1$/.test(value)) {
		return null;
	}
	const whole = /^(['"]?)(\d+)\1$/.exec(value);
	return whole ? Number(whole[2]) : NaN;
}

/**
 * The number a manifest gives a variable: the whole `value` on the line after its name (see `seconds`). Null when the
 * manifest does not give the variable a value.
 */
function manifestValueIn(manifest: string, name: string): number | null {
	// `\r?` twice: a checkout may end its lines with CRLF
	const entry = new RegExp(`(?:name|key): ${name}[ \\t]*\\r?\\n[ \\t]*value:[ \\t]*(.*?)[ \\t]*\\r?$`, 'm').exec(
		manifest
	);
	return entry ? seconds(entry[1]) : null;
}

/**
 * The number a `NAME=123` line gives a variable: an env file's, or a Fly configuration's `NAME = "123"` (see
 * `seconds`). Null when no line sets it.
 */
function assignmentValueIn(text: string, name: string): number | null {
	const line = new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*(.*?)[ \\t]*\\r?$`, 'm').exec(text);
	return line ? seconds(line[1]) : null;
}

/** The number a file of the repository gives a variable, read the way a file of its kind states it. */
const valueIn = (file: string, name: string) =>
	file.endsWith('.yaml') ? manifestValueIn(read(file), name) : assignmentValueIn(read(file), name);

/** The access token lifetime a file gives: the code default when unset, NaN (failing a comparison) when refused. */
const accessLifetimeIn = (file: string) =>
	valueIn(file, 'JWT_TOKEN_EXPIRATION_TIME') ?? DEFAULT_ACCESS_TOKEN_LIFETIME_S;

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
		['is a placeholder', "- name: LIFETIME\n  value: '$LIFETIME'\n"]
	])('is refused, not taken for an unset one, when it %s', (_case, manifest) => {
		expect(manifestValueIn(manifest, 'LIFETIME')).toBeNaN();
	});

	it.each([
		['belongs to another variable', '- key: OTHER\n  value: 604800\n'],
		['is empty', "- name: LIFETIME\n  value: ''\n"]
	])('is unset when the value %s', (_case, manifest) => {
		expect(manifestValueIn(manifest, 'LIFETIME')).toBeNull();
	});
});

describe('the value a `NAME=123` line gives a variable', () => {
	it.each([
		['bare', 'LIFETIME=604800\n', 604800],
		['between quotes, with spaces around the sign (Fly)', '  LIFETIME = "604800"\n', 604800],
		['in a file whose lines end with CRLF', 'OTHER=1\r\nLIFETIME=604800\r\n', 604800],
		['at the end of the file', 'LIFETIME=604800', 604800]
	])('is read %s', (_case, text, value) => {
		expect(assignmentValueIn(text, 'LIFETIME')).toBe(value);
	});

	it.each([
		['goes on after the digits', 'LIFETIME=604800e3\n'],
		['has one quote of a pair', 'LIFETIME="604800\n']
	])('is refused, not taken for an unset one, when it %s', (_case, text) => {
		expect(assignmentValueIn(text, 'LIFETIME')).toBeNaN();
	});

	it.each([
		['only another variable is set', 'OTHER=604800\n'],
		['the line is a comment', '# LIFETIME=604800\n'],
		['the value is empty', 'LIFETIME=\n']
	])('is unset when %s', (_case, text) => {
		expect(assignmentValueIn(text, 'LIFETIME')).toBeNull();
	});
});

describe('the refresh token lifetime', () => {
	it('outlives the access token by default', () => {
		expect(DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME).toBeGreaterThan(DEFAULT_ACCESS_TOKEN_LIFETIME_S);
	});

	it.each(SAMPLES)('is the code default in %s', (sample) => {
		expect(valueIn(sample, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBe(DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME);
	});

	it.each(SAMPLES)('outlives the access token in %s', (sample) => {
		expect(valueIn(sample, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBeGreaterThan(accessLifetimeIn(sample));
	});

	it.each(DEMO_DEPLOYMENTS)('is the code default in the demo deployment %s', (deployment) => {
		expect(valueIn(deployment, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBe(
			DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME
		);
	});

	it.each(DEMO_DEPLOYMENTS)('outlives the access token in the demo deployment %s', (deployment) => {
		expect(valueIn(deployment, 'JWT_REFRESH_TOKEN_EXPIRATION_TIME')).toBeGreaterThan(accessLifetimeIn(deployment));
	});

	it('is checked again by Nx whenever one of those files changes', () => {
		// They are outside the project, so a cached run of its tests would otherwise pass for a file it never read
		const { inputs } = JSON.parse(read('packages/config/project.json')).targets.test;

		expect(inputs).toEqual(
			expect.arrayContaining([...SAMPLES, ...DEMO_DEPLOYMENTS].map((file) => `{workspaceRoot}/${file}`))
		);
	});
});
