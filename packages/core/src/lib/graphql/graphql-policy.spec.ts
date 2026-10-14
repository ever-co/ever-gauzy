import { GRAPHQL_POLICY_ENV, resolveGraphqlPolicy } from './graphql-policy';

/**
 * Introspection is the one policy member a deployment states in both directions: off where the
 * editor is served, on where a hardened endpoint still feeds a codegen pipeline. Both statements have
 * to be honoured; the environment variable overrides either.
 */
describe('resolveGraphqlPolicy — introspection', () => {
	const production = { NODE_ENV: 'production' };
	const development = { NODE_ENV: 'development' };

	it('honours an explicit true where the playground is off', () => {
		// The deployment the option exists for. It resolved `false`, because only an explicit `false`
		// was read from the configuration.
		const policy = resolveGraphqlPolicy(production, { playground: false, debug: false, introspection: true });

		expect(policy.playground).toBe(false);
		expect(policy.introspection).toBe(true);
	});

	it('honours an explicit false where the playground is on', () => {
		expect(resolveGraphqlPolicy(development, { playground: true, introspection: false }).introspection).toBe(false);
	});

	it('follows the playground when the deployment states nothing, as every shipped configuration does', () => {
		expect(resolveGraphqlPolicy(production, { playground: true, debug: true }).introspection).toBe(false);
		expect(resolveGraphqlPolicy(development, { playground: true, debug: true }).introspection).toBe(true);
		expect(resolveGraphqlPolicy(development, { playground: false }).introspection).toBe(false);
	});

	it('lets the environment override a stated value in either direction', () => {
		expect(
			resolveGraphqlPolicy({ ...production, [GRAPHQL_POLICY_ENV.INTROSPECTION]: 'false' }, { introspection: true })
				.introspection
		).toBe(false);
		expect(
			resolveGraphqlPolicy({ ...development, [GRAPHQL_POLICY_ENV.INTROSPECTION]: 'on' }, { introspection: false })
				.introspection
		).toBe(true);
	});

	it('does not extend the same reading to debug, which every shipped configuration states as true', () => {
		// `debug: true` in a shipped configuration is the default nobody chose, so it must not turn the
		// production debug output back on.
		expect(resolveGraphqlPolicy(production, { playground: true, debug: true }).debug).toBe(false);
	});
});

describe('resolveGraphqlPolicy — persisted queries', () => {
	it('is off unless a deployment asks, and on when it does', () => {
		expect(resolveGraphqlPolicy({}, {}).persistedQueries).toBe(false);
		expect(resolveGraphqlPolicy({}, { persistedQueries: true }).persistedQueries).toBe(true);
		expect(
			resolveGraphqlPolicy({ [GRAPHQL_POLICY_ENV.PERSISTED_QUERIES]: 'false' }, { persistedQueries: true })
				.persistedQueries
		).toBe(false);
	});
});
