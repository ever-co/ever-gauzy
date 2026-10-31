// Cases for ./codespaces-env.sh, the Codespaces URLs of the dev container (ever-co/ever-gauzy#5570).
// Run with `node --test .devcontainer/codespaces-env.test.mjs`; it needs Node and a POSIX `sh`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SCRIPT = fileURLToPath(new URL('./codespaces-env.sh', import.meta.url)).replace(/\\/g, '/');
const VARIABLES = ['API_BASE_URL', 'CLIENT_BASE_URL', 'ALLOWED_ORIGINS'];

/** Sources the script in `sh` with only PATH and `env` set, and returns the three variables (null when unset). */
function sourced(env) {
	const print = VARIABLES.map((name) => `printf '%s\\n' "\${${name}-<unset>}"`).join('; ');
	const output = execFileSync('sh', ['-c', `. "$0"; ${print}`, SCRIPT], {
		env: { PATH: process.env.PATH, ...env },
		encoding: 'utf8'
	});
	const values = output.split('\n').slice(0, VARIABLES.length);
	return Object.fromEntries(
		VARIABLES.map((name, index) => [name, values[index] === '<unset>' ? null : values[index]])
	);
}

const CODESPACE = { CODESPACE_NAME: 'octo-fortnight-x7r', GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev' };

describe('codespaces-env.sh', () => {
	it('changes nothing outside a codespace (VS Code Dev Containers on your machine)', () => {
		assert.deepEqual(sourced({}), { API_BASE_URL: null, CLIENT_BASE_URL: null, ALLOWED_ORIGINS: null });
		assert.deepEqual(sourced({ CODESPACE_NAME: 'octo-fortnight-x7r' }), {
			API_BASE_URL: null,
			CLIENT_BASE_URL: null,
			ALLOWED_ORIGINS: null
		});
	});

	it('points the API and web UI URLs at the forwarded ports in a codespace, and CORS at the web UI', () => {
		assert.deepEqual(sourced(CODESPACE), {
			API_BASE_URL: 'https://octo-fortnight-x7r-3000.app.github.dev',
			CLIENT_BASE_URL: 'https://octo-fortnight-x7r-4200.app.github.dev',
			ALLOWED_ORIGINS: 'https://octo-fortnight-x7r-4200.app.github.dev'
		});
	});

	it('keeps values that are already set', () => {
		assert.deepEqual(
			sourced({ ...CODESPACE, API_BASE_URL: 'http://localhost:3000', CLIENT_BASE_URL: 'http://localhost:4200' }),
			{
				API_BASE_URL: 'http://localhost:3000',
				CLIENT_BASE_URL: 'http://localhost:4200',
				ALLOWED_ORIGINS: 'http://localhost:4200'
			}
		);
		assert.equal(sourced({ ...CODESPACE, ALLOWED_ORIGINS: '*' }).ALLOWED_ORIGINS, '*');
	});
});
