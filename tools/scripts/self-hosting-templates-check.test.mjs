/**
 * Cases for self-hosting-templates-check.mjs: the readers and the rules for each template.
 * Run: `node --test tools/scripts/self-hosting-templates-check.test.mjs`
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	API_PATH_KINDS,
	apiPaths,
	appPlatformEnvs,
	appPlatformProblems,
	appPlatformRouteProblems,
	appPlatformRoutes,
	caddyApiPatterns,
	caddyPathMatches,
	caddyRouteProblems,
	composeProblems,
	envSampleProblems,
	requiredSecrets
} from './self-hosting-templates-check.mjs';

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

describe('apiPaths', () => {
	const sources = {
		restPrefix: "\tconst globalPrefix = 'api';\n\tapp.setGlobalPrefix(globalPrefix);",
		filesRoot: "\t\t\tserveRoot: '/public/', // Root URL from which the static files are served",
		graphqlPath: "export const DEFAULT_GRAPHQL_API_PATH = 'graphql';",
		swaggerPath:
			"\t\tversion = '1.0',\n\t\tswaggerPath = 'swg',\n\t\tscalarPath = 'docs',\n\t\tswaggerPath?: string;"
	};

	it('reads the REST prefix, the GraphQL path, the uploaded files root and the Swagger UI path where the API declares them', () => {
		assert.deepEqual(apiPaths(sources), [
			{ path: '/api', what: 'REST' },
			{ path: '/api/health', what: 'REST' },
			{ path: '/graphql', what: 'GraphQL, including the subscription socket' },
			{ path: '/public/avatar.png', what: 'uploaded files' },
			{ path: '/swg', what: 'Swagger UI' },
			{ path: '/swg/swagger-ui-init.js', what: 'Swagger UI' },
			{ path: '/swg-json', what: 'the OpenAPI document' },
			{ path: '/swg-yaml', what: 'the OpenAPI document' }
		]);
		assert.deepEqual(new Set(apiPaths(sources).map((path) => path.what)), new Set(Object.values(API_PATH_KINDS)));
	});

	it('leaves out a declaration it cannot find (the gate then reports it)', () => {
		const paths = apiPaths({ ...sources, graphqlPath: "export const GRAPHQL_PATH = 'graphql';" });
		assert.equal(
			paths.some((path) => path.what.startsWith('GraphQL')),
			false
		);
		const withoutSwagger = apiPaths({ ...sources, swaggerPath: "SwaggerModule.setup('swg', app, document);" });
		assert.equal(
			withoutSwagger.some((path) => path.path.startsWith('/swg')),
			false
		);
	});
});

const SPEC = `
spec:
  envs:
    - key: JWT_SECRET
      type: SECRET
  services:
    - name: api
      envs:
        - key: NODE_ENV
          value: production
        - key: EXPRESS_SESSION_SECRET
          scope: RUN_TIME
          type: SECRET
        # a comment between entries
        - key: DEMO_ADMIN_PASSWORD
          type: 'SECRET'
    - name: webapp
      envs:
        - key: API_BASE_URL
          value: \${APP_URL}
  workers:
    - name: worker
      envs:
        - key: REDIS_ENABLED
          value: 'true'
  databases:
    - name: db
  ingress:
    rules:
      - match:
          path:
            prefix: /api
        component:
          name: api
          preserve_path_prefix: true
      - match:
          path:
            prefix: /graphql
        component:
          name: api
          preserve_path_prefix: true
      - match:
          path:
            prefix: /public
        component:
          name: api
          preserve_path_prefix: true
      - match:
          path:
            prefix: /
        component:
          name: webapp
`;

describe('appPlatformEnvs', () => {
	it('reads every entry with the component whose list holds it (null at app level)', () => {
		assert.deepEqual(appPlatformEnvs(SPEC), [
			{ component: null, key: 'JWT_SECRET', type: 'SECRET', hasValue: false },
			{ component: 'api', key: 'NODE_ENV', type: null, hasValue: true },
			{ component: 'api', key: 'EXPRESS_SESSION_SECRET', type: 'SECRET', hasValue: false },
			{ component: 'api', key: 'DEMO_ADMIN_PASSWORD', type: 'SECRET', hasValue: false },
			{ component: 'webapp', key: 'API_BASE_URL', type: null, hasValue: true },
			{ component: 'worker', key: 'REDIS_ENABLED', type: null, hasValue: true }
		]);
	});

	it('still reads app-level envs declared after the components', () => {
		const spec = SPEC.replace('  envs:\n    - key: JWT_SECRET\n      type: SECRET\n', '').replace(
			'  databases:',
			'  envs:\n    - key: JWT_SECRET\n      type: SECRET\n  databases:'
		);
		assert.deepEqual(
			appPlatformEnvs(spec).find((env) => env.key === 'JWT_SECRET'),
			{ component: null, key: 'JWT_SECRET', type: 'SECRET', hasValue: false }
		);
	});
});

describe('appPlatformProblems', () => {
	const secrets = ['JWT_SECRET', 'EXPRESS_SESSION_SECRET', 'DEMO_ADMIN_PASSWORD'];

	it('passes secrets asked for at app level or on the api component, with no value', () => {
		assert.deepEqual(appPlatformProblems(SPEC, secrets), []);
	});

	it('reports a secret neither the app nor the api component asks for', () => {
		assert.deepEqual(appPlatformProblems(SPEC, [...secrets, 'JWT_REFRESH_TOKEN_SECRET']), [
			'api: does not ask for JWT_REFRESH_TOKEN_SECRET (an envs entry with `type: SECRET` and no value, on the ' +
				'api component or at app level)'
		]);
	});

	it('reports a SECRET that ships a value, at app level too', () => {
		const spec = SPEC.replace(
			'      type: SECRET\n  services:',
			'      type: SECRET\n      value: changeme\n  services:'
		);
		assert.deepEqual(appPlatformProblems(spec, secrets), [
			'app-level envs: JWT_SECRET ships a value; declare it as `type: SECRET` with no value'
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
		assert.deepEqual(
			appPlatformProblems(SPEC, ['REDIS_ENABLED']).at(-1),
			'api: does not ask for REDIS_ENABLED (an envs entry with `type: SECRET` and no value, on the api component or at app level)'
		);
	});
});

const PATHS = [
	{ path: '/api', what: 'REST' },
	{ path: '/api/health', what: 'REST' },
	{ path: '/graphql', what: 'GraphQL' },
	{ path: '/public/avatar.png', what: 'uploaded files' }
];

describe('appPlatformRoutes', () => {
	it('reads every ingress rule', () => {
		assert.deepEqual(appPlatformRoutes(SPEC), [
			{ prefix: '/api', component: 'api', preservePathPrefix: true },
			{ prefix: '/graphql', component: 'api', preservePathPrefix: true },
			{ prefix: '/public', component: 'api', preservePathPrefix: true },
			{ prefix: '/', component: 'webapp', preservePathPrefix: false }
		]);
	});
});

describe('appPlatformRouteProblems', () => {
	it('passes a spec that sends every API path to the api, path kept, and the rest to the web app', () => {
		assert.deepEqual(appPlatformRouteProblems(SPEC, PATHS), []);
	});

	it('reports an API path that falls through to the web app (the /graphql miss)', () => {
		const spec = SPEC.replace(
			/ {6}- match:\n {10}path:\n {12}prefix: \/graphql\n[\s\S]*?preserve_path_prefix: true\n/,
			''
		);
		assert.deepEqual(appPlatformRouteProblems(spec, PATHS), ['/graphql (GraphQL) goes to webapp, not the api']);
	});

	it('reports an API rule that strips its prefix', () => {
		const spec = SPEC.replace(
			'            prefix: /public\n        component:\n          name: api\n          preserve_path_prefix: true',
			'            prefix: /public\n        component:\n          name: api'
		);
		assert.deepEqual(appPlatformRouteProblems(spec, PATHS), [
			'/public/avatar.png (uploaded files) reaches the api without /public: set preserve_path_prefix'
		]);
	});

	it('reports a web app path sent to the api, and does not match a prefix inside a path segment', () => {
		const spec = SPEC.replace('prefix: /api', 'prefix: /a');
		assert.deepEqual(appPlatformRouteProblems(spec, PATHS), [
			'/api (REST) goes to webapp, not the api',
			'/api/health (REST) goes to webapp, not the api'
		]);
		assert.deepEqual(
			appPlatformRouteProblems(SPEC.replace('prefix: /api', 'prefix: /auth'), [])[0],
			'/auth/login (the web app) goes to the api'
		);
	});
});

const CADDYFILE = `
{$GAUZY_DOMAIN:localhost} {
	# The API
	@api path /api /api/* /graphql /public/*
	handle @api {
		reverse_proxy api:3000 {
			header_up -CF-Connecting-IP
		}
	}

	handle {
		reverse_proxy webapp:4200
	}
}
`;

describe('caddyPathMatches', () => {
	it('matches exact paths and * wildcards, case-insensitively', () => {
		assert.equal(caddyPathMatches('/graphql', '/graphql'), true);
		assert.equal(caddyPathMatches('/graphql', '/graphql/x'), false);
		assert.equal(caddyPathMatches('/api/*', '/api/health'), true);
		assert.equal(caddyPathMatches('/api/*', '/api'), false);
		assert.equal(caddyPathMatches('/public/*', '/PUBLIC/a.png'), true);
		assert.equal(caddyPathMatches('*.png', '/public/a.png'), true);
	});
});

describe('caddyRouteProblems', () => {
	it('reads the patterns of the matchers whose handle block proxies to the api', () => {
		assert.deepEqual(caddyApiPatterns(CADDYFILE), ['/api', '/api/*', '/graphql', '/public/*']);
	});

	it('reads an inline `reverse_proxy @matcher api:...` too', () => {
		const inline = '@backend path /graphql\nreverse_proxy @backend api:3000\nreverse_proxy webapp:4200';
		assert.deepEqual(caddyApiPatterns(inline), ['/graphql']);
	});

	it('passes a Caddyfile that proxies every API path to the api and the rest to the web app', () => {
		assert.deepEqual(caddyRouteProblems(CADDYFILE, PATHS), []);
	});

	it('reports an API path left to the web app (the /graphql miss)', () => {
		assert.deepEqual(caddyRouteProblems(CADDYFILE.replace(' /graphql', ''), PATHS), [
			'/graphql (GraphQL) is not proxied to the api'
		]);
	});

	it('reports a web app path proxied to the api', () => {
		assert.deepEqual(caddyRouteProblems(CADDYFILE.replace('/public/*', '/*'), PATHS), [
			'/ (the web app) is proxied to the api',
			'/auth/login (the web app) is proxied to the api'
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
