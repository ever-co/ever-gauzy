/**
 * Cases for self-hosting-secrets-check.mjs: the readers and the rules for each template.
 * Run: `node --test tools/scripts/self-hosting-secrets-check.test.mjs`
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	appPlatformEnvs,
	appPlatformProblems,
	composeProblems,
	envSampleProblems,
	requiredSecrets
} from './self-hosting-secrets-check.mjs';

describe('requiredSecrets', () => {
	const source = [
		'const CHECKED_SECRETS: ReadonlyArray<string> = [',
		"\t'JWT_SECRET',",
		"\t'EXPRESS_SESSION_SECRET'",
		'];',
		'const KNOWN_DEFAULT_SEED_CREDENTIALS: ReadonlyArray<{',
		'\tkey: string;',
		'\tvalue: string;',
		'}> = [',
		"\t{ key: 'DEMO_SUPER_ADMIN_PASSWORD', value: 'admin', email: 'admin@ever.co', role: 'SUPER_ADMIN' },",
		"\t{ key: 'DEMO_EMPLOYEE_PASSWORD', value: '12345678', email: 'employee@ever.co', role: 'EMPLOYEE' }",
		'];'
	].join('\n');

	it('reads both lists as validate-secrets.ts declares them', () => {
		assert.deepEqual(requiredSecrets(source), {
			checked: ['JWT_SECRET', 'EXPRESS_SESSION_SECRET'],
			seed: ['DEMO_SUPER_ADMIN_PASSWORD', 'DEMO_EMPLOYEE_PASSWORD']
		});
	});

	it('finds nothing when a list is renamed (the gate then fails instead of passing on nothing)', () => {
		assert.deepEqual(requiredSecrets(source.replace('CHECKED_SECRETS', 'SECRETS_TO_CHECK')).checked, []);
	});
});

const SPEC = `
spec:
  services:
    - name: api
      envs:
        - key: NODE_ENV
          value: production
        - key: JWT_SECRET
          scope: RUN_TIME
          type: SECRET
        # a comment between entries
        - key: DEMO_ADMIN_PASSWORD
          type: 'SECRET'
    - name: webapp
      envs:
        - key: API_BASE_URL
          value: \${APP_URL}
  databases:
    - name: db
`;

describe('appPlatformEnvs', () => {
	it('reads every entry with its component, type and whether it has a value', () => {
		assert.deepEqual(appPlatformEnvs(SPEC), [
			{ component: 'api', key: 'NODE_ENV', type: null, hasValue: true },
			{ component: 'api', key: 'JWT_SECRET', type: 'SECRET', hasValue: false },
			{ component: 'api', key: 'DEMO_ADMIN_PASSWORD', type: 'SECRET', hasValue: false },
			{ component: 'webapp', key: 'API_BASE_URL', type: null, hasValue: true }
		]);
	});
});

describe('appPlatformProblems', () => {
	const secrets = ['JWT_SECRET', 'DEMO_ADMIN_PASSWORD'];

	it('passes a template that asks for every secret with no value', () => {
		assert.deepEqual(appPlatformProblems(SPEC, secrets), []);
	});

	it('reports a secret the API component does not ask for', () => {
		assert.deepEqual(appPlatformProblems(SPEC, [...secrets, 'EXPRESS_SESSION_SECRET']), [
			'api: does not ask for EXPRESS_SESSION_SECRET (an envs entry with `type: SECRET`, no value)'
		]);
	});

	it('reports a SECRET that ships a value', () => {
		const spec = SPEC.replace('          type: SECRET\n', '          type: SECRET\n          value: changeme\n');
		assert.deepEqual(appPlatformProblems(spec, secrets), [
			'api: JWT_SECRET ships a value; declare it as `type: SECRET` with no value'
		]);
	});

	it('reports a required secret declared as a plain variable with a value', () => {
		const spec = SPEC.replace("          type: 'SECRET'", '          value: admin');
		assert.deepEqual(appPlatformProblems(spec, secrets), [
			'api: DEMO_ADMIN_PASSWORD ships a value; declare it as `type: SECRET` with no value',
			'api: DEMO_ADMIN_PASSWORD is not `type: SECRET`'
		]);
	});

	it('does not count a secret declared on another component only', () => {
		const spec = SPEC.replace(
			'        - key: API_BASE_URL',
			'        - key: EXPRESS_SESSION_SECRET\n          type: SECRET\n        - key: API_BASE_URL'
		);
		assert.deepEqual(appPlatformProblems(spec, ['EXPRESS_SESSION_SECRET']), [
			'api: does not ask for EXPRESS_SESSION_SECRET (an envs entry with `type: SECRET`, no value)'
		]);
	});
});

describe('composeProblems', () => {
	const compose = [
		'x-env: &env',
		'  JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET in .env.caddy}',
		'  # JWT_SECRET: commented-out-example',
		'services:',
		'  db:',
		'    environment:',
		'      POSTGRES_PASSWORD: ${DB_PASS:?set DB_PASS}',
		'  api:',
		'    environment:',
		'      <<: *env',
		'      DB_PASS: ${DB_PASS:?set DB_PASS}'
	].join('\n');

	it('passes secrets that are required wherever they are used', () => {
		assert.deepEqual(composeProblems(compose, ['JWT_SECRET', 'DB_PASS']), []);
	});

	it('reports a secret it never asks for', () => {
		assert.deepEqual(composeProblems(compose, ['EXPRESS_SESSION_SECRET']), [
			'never asks for EXPRESS_SESSION_SECRET (`${EXPRESS_SESSION_SECRET:?message}`)'
		]);
	});

	it('reports a default, an empty fallback or a plain reference anywhere', () => {
		for (const use of ['${DB_PASS:-gauzy}', '${DB_PASS-}', '${DB_PASS}']) {
			const source = compose.replace('POSTGRES_PASSWORD: ${DB_PASS:?set DB_PASS}', `POSTGRES_PASSWORD: ${use}`);
			assert.deepEqual(
				composeProblems(source, ['DB_PASS']),
				[
					'${DB_PASS} can be empty or defaulted; use `${DB_PASS:?message}` so compose refuses to start without it'
				],
				use
			);
		}
	});

	it('does not confuse a longer variable name with the secret', () => {
		assert.deepEqual(composeProblems('A: ${JWT_SECRET_FILE:-x}\nB: ${JWT_SECRET:?x}', ['JWT_SECRET']), []);
	});

	it('reports a literal value, in map or list form', () => {
		assert.deepEqual(composeProblems(`${compose}\n      JWT_SECRET: hunter2`, ['JWT_SECRET']), [
			'JWT_SECRET has a literal value: JWT_SECRET: hunter2'
		]);
		assert.deepEqual(composeProblems(`${compose}\n      - JWT_SECRET=hunter2`, ['JWT_SECRET']), [
			'JWT_SECRET has a literal value: - JWT_SECRET=hunter2'
		]);
	});
});

describe('envSampleProblems', () => {
	const sample = ['# Secrets', 'JWT_SECRET=', 'DB_PASS=""', '# DEMO_ADMIN_PASSWORD=admin'].join('\n');

	it('passes secrets listed with an empty value', () => {
		assert.deepEqual(envSampleProblems(sample, ['JWT_SECRET', 'DB_PASS']), []);
	});

	it('reports a secret that is missing or only commented out', () => {
		assert.deepEqual(envSampleProblems(sample, ['DEMO_ADMIN_PASSWORD']), [
			'does not list DEMO_ADMIN_PASSWORD= for the operator to fill in'
		]);
	});

	it('reports a secret with a value', () => {
		assert.deepEqual(envSampleProblems(`${sample}\nEXPRESS_SESSION_SECRET=changeme`, ['EXPRESS_SESSION_SECRET']), [
			'EXPRESS_SESSION_SECRET has a value; leave it empty for the operator to fill in'
		]);
	});
});
