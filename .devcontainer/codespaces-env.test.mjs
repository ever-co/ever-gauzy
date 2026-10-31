// Cases for ./codespaces-env.sh, the Codespaces URLs of the dev container (ever-co/ever-gauzy#5570).
// Run with `node --test .devcontainer/codespaces-env.test.mjs`; it needs Node and `bash` (the dev container's shells
// source the script from ~/.bashrc and ~/.zshrc).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SCRIPT = fileURLToPath(new URL('./codespaces-env.sh', import.meta.url)).replace(/\\/g, '/');
const TRACKED_ENV_LOCAL = fileURLToPath(new URL('../.env.local', import.meta.url));
const VARIABLES = ['API_BASE_URL', 'CLIENT_BASE_URL', 'ALLOWED_ORIGINS', 'ENV_LOCAL_NO_OVERRIDE', '_gauzy_root'];

/**
 * Sources the script as the rc files do (`. <script> <workspace>`), in a workspace holding `files`, with only PATH and
 * `env` set. Returns the variables (null when unset) and whether its helper functions are still defined.
 */
function sourced(env, files = {}) {
	const workspace = mkdtempSync(join(tmpdir(), 'gauzy-codespaces-env-'));
	try {
		for (const [name, content] of Object.entries(files)) {
			writeFileSync(join(workspace, name), content);
		}
		const print = VARIABLES.map((name) => `printf '%s\\n' "\${${name}-<unset>}"`).join('; ');
		const helpers = `if command -v _gauzy_keep || command -v _gauzy_file_value; then echo defined; else echo gone; fi 2> /dev/null | tail -n 1`;
		const output = execFileSync(
			'bash',
			['-c', `. "$0" "$1"; ${print}; ${helpers}`, SCRIPT, workspace.replace(/\\/g, '/')],
			{
				env: { PATH: process.env.PATH, ...env },
				encoding: 'utf8'
			}
		);
		const lines = output.split('\n');
		const values = Object.fromEntries(
			VARIABLES.map((name, index) => [name, lines[index] === '<unset>' ? null : lines[index]])
		);
		return { ...values, helpers: lines[VARIABLES.length] };
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

const CODESPACE = { CODESPACE_NAME: 'octo-fortnight-x7r', GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev' };
const API = 'https://octo-fortnight-x7r-3000.app.github.dev';
const UI = 'https://octo-fortnight-x7r-4200.app.github.dev';
const FORWARDED = {
	API_BASE_URL: API,
	CLIENT_BASE_URL: UI,
	ALLOWED_ORIGINS: UI,
	ENV_LOCAL_NO_OVERRIDE: 'API_BASE_URL,CLIENT_BASE_URL,ALLOWED_ORIGINS',
	_gauzy_root: null,
	helpers: 'gone'
};

describe('codespaces-env.sh', () => {
	it('changes nothing outside a codespace (VS Code Dev Containers on your machine)', () => {
		const untouched = {
			API_BASE_URL: null,
			CLIENT_BASE_URL: null,
			ALLOWED_ORIGINS: null,
			ENV_LOCAL_NO_OVERRIDE: null,
			_gauzy_root: null,
			helpers: 'gone'
		};
		assert.deepEqual(sourced({}), untouched);
		assert.deepEqual(sourced({ CODESPACE_NAME: 'octo-fortnight-x7r' }), untouched);
	});

	it('points the API and web UI URLs at the forwarded ports, CORS at the web UI, and keeps them over .env.local', () => {
		assert.deepEqual(sourced(CODESPACE), FORWARDED);
	});

	it("treats the tracked .env.local's localhost URLs as defaults, not as your values", () => {
		assert.deepEqual(sourced(CODESPACE, { '.env.local': readFileSync(TRACKED_ENV_LOCAL, 'utf8') }), FORWARDED);
		assert.deepEqual(
			sourced(CODESPACE, { '.env': 'export API_BASE_URL="http://localhost:3000"\r\nALLOWED_ORIGINS=\r\n' }),
			FORWARDED
		);
	});

	it('keeps values the shell already has, and lists them so that the API keeps them over .env.local too', () => {
		assert.deepEqual(
			sourced({ ...CODESPACE, API_BASE_URL: 'http://localhost:3000', CLIENT_BASE_URL: 'http://localhost:4200' }),
			{
				...FORWARDED,
				API_BASE_URL: 'http://localhost:3000',
				CLIENT_BASE_URL: 'http://localhost:4200',
				ALLOWED_ORIGINS: 'http://localhost:4200'
			}
		);
		assert.deepEqual(sourced({ ...CODESPACE, ALLOWED_ORIGINS: '*' }), { ...FORWARDED, ALLOWED_ORIGINS: '*' });
	});

	it('uses a value you wrote in .env.local or .env, and keeps it over .env.local', () => {
		assert.deepEqual(
			sourced(CODESPACE, {
				'.env.local': 'API_BASE_URL=https://api.example.test\nCLIENT_BASE_URL=http://localhost:4200\n',
				'.env': "ALLOWED_ORIGINS='https://ui.example.test'\n"
			}),
			{ ...FORWARDED, API_BASE_URL: 'https://api.example.test', ALLOWED_ORIGINS: 'https://ui.example.test' }
		);
	});

	it(".env's value counts while .env.local holds the localhost default, and .env.local's wins over it", () => {
		const tracked = readFileSync(TRACKED_ENV_LOCAL, 'utf8');
		const dotEnv = 'API_BASE_URL=https://from-dot-env.example.test\nCLIENT_BASE_URL=https://ui.example.test\n';
		assert.deepEqual(sourced(CODESPACE, { '.env.local': tracked, '.env': dotEnv }), {
			...FORWARDED,
			API_BASE_URL: 'https://from-dot-env.example.test',
			CLIENT_BASE_URL: 'https://ui.example.test',
			ALLOWED_ORIGINS: 'https://ui.example.test'
		});
		const envLocal = `${tracked}\nAPI_BASE_URL=https://from-env-local.example.test\n`;
		assert.equal(
			sourced(CODESPACE, { '.env.local': envLocal, '.env': dotEnv }).API_BASE_URL,
			'https://from-env-local.example.test'
		);
	});

	it('reads values as dotenv does: inside their quotes, before a # comment, without trailing spaces', () => {
		assert.deepEqual(
			sourced(CODESPACE, {
				'.env':
					'API_BASE_URL="https://api.example.test" # custom API\n' +
					'CLIENT_BASE_URL=https://ui.example.test   # the web UI   \n' +
					"ALLOWED_ORIGINS='https://ui.example.test,https://admin.example.test'  \n"
			}),
			{
				...FORWARDED,
				API_BASE_URL: 'https://api.example.test',
				CLIENT_BASE_URL: 'https://ui.example.test',
				ALLOWED_ORIGINS: 'https://ui.example.test,https://admin.example.test'
			}
		);
		assert.equal(
			sourced(CODESPACE, { '.env': 'API_BASE_URL="https://api.example.test/#/home"\n' }).API_BASE_URL,
			'https://api.example.test/#/home'
		);
		// A default with a comment after it is still the default.
		assert.deepEqual(sourced(CODESPACE, { '.env': 'API_BASE_URL=http://localhost:3000 # default\n' }), FORWARDED);
	});

	it('adds to a list the environment already has, once', () => {
		assert.equal(
			sourced({ ...CODESPACE, ENV_LOCAL_NO_OVERRIDE: 'DB_TYPE' }).ENV_LOCAL_NO_OVERRIDE,
			'DB_TYPE,API_BASE_URL,CLIENT_BASE_URL,ALLOWED_ORIGINS'
		);
		// A nested shell sources the script again, with the parent's exported values and list.
		const nested = { ...CODESPACE, ...Object.fromEntries(Object.entries(FORWARDED).slice(0, 4)) };
		assert.deepEqual(sourced(nested), FORWARDED);
	});
});
