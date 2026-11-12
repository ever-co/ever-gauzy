// cspell:ignore gzcwh
import * as express from 'express';
import * as request from 'supertest';
import { GRAPHQL_MAX_BODY_BYTES_DEFAULT, graphqlEndpointPath, installBodyParsers, resolveGraphqlBodyLimit, SMALL_BODY_ROUTES } from './body-parsers';

/**
 * The GraphQL endpoint's body ceiling (SEC-C-03).
 *
 * Every route accepted a 50 MB JSON body, the GraphQL endpoint included — and a GraphQL body is parsed and validated
 * before authentication. The endpoint now has a ceiling of its own; every other route keeps 50 MB.
 *
 * A real Express app with the parsers mounted exactly as bootstrap mounts them.
 */
describe('installBodyParsers', () => {
	const app = (env: Record<string, string | undefined> = {}) => {
		const server = express();
		installBodyParsers(server, { graphqlPath: '/graphql', env });
		server.post(['/graphql', '/api/import', '/api/chat/hooks/:token', '/api/integration/jira/webhook/:integrationId'], (req, res) =>
			res.json({ bytes: JSON.stringify(req.body).length })
		);
		return server;
	};

	/** A JSON body of about `bytes` bytes. */
	const body = (bytes: number) => ({ query: '{ __typename }', variables: { padding: 'x'.repeat(bytes) } });

	it('refuses a GraphQL body over its ceiling with 413', async () => {
		// The failure scenario: up to 50 MB of pre-auth document parsed and validated per request.
		await request(app()).post('/graphql').send(body(GRAPHQL_MAX_BODY_BYTES_DEFAULT + 1024)).expect(413);
	});

	it('holds the ceiling for a form body too, which the 50 MB form parser used to read', async () => {
		const form = `query=${encodeURIComponent('{ __typename }')}&padding=${'x'.repeat(GRAPHQL_MAX_BODY_BYTES_DEFAULT + 1024)}`;

		await request(app()).post('/graphql').type('form').send(form).expect(413);
		await request(app()).post('/api/import').type('form').send(form).expect(200);
	});

	it('refuses a body over the small ceiling of a public webhook route before reading it, and takes one under it', async () => {
		const [hooks] = SMALL_BODY_ROUTES;
		expect(hooks.path).toBe('/api/chat/hooks');
		await request(app()).post('/api/chat/hooks/gzcwh_token').send({ text: 'x'.repeat(hooks.limit + 1024) }).expect(413);
		await request(app()).post('/api/chat/hooks/gzcwh_token').type('form').send(`payload=${'x'.repeat(hooks.limit + 1024)}`).expect(413);
		await request(app()).post('/api/chat/hooks/gzcwh_token').send({ text: 'x'.repeat(100 * 1024) }).expect(200);
		await request(app()).post('/api/import').send({ text: 'x'.repeat(hooks.limit + 1024) }).expect(200);
	});

	it('refuses a Jira webhook delivery over its 2 MiB ceiling before reading it, and takes one under it', async () => {
		const jira = SMALL_BODY_ROUTES.find((route) => route.path === '/api/integration/jira/webhook');
		expect(jira?.limit).toBe(2 * 1024 * 1024);
		const limit = jira?.limit ?? 0;
		await request(app()).post('/api/integration/jira/webhook/0f8a4a0e-5b8a-4c2e-9d55-1f2a3b4c5d6e').send({ text: 'x'.repeat(limit + 1024) }).expect(413);
		await request(app()).post('/api/integration/jira/webhook/0f8a4a0e-5b8a-4c2e-9d55-1f2a3b4c5d6e').send({ text: 'x'.repeat(64 * 1024) }).expect(200);
	});

	it('accepts a GraphQL body under its ceiling', async () => {
		await request(app()).post('/graphql').send(body(64 * 1024)).expect(200);
	});

	it('leaves every other route at 50 MB', async () => {
		await request(app()).post('/api/import').send(body(2 * GRAPHQL_MAX_BODY_BYTES_DEFAULT)).expect(200);
	});

	it('takes its ceiling from the environment', async () => {
		await request(app({ GRAPHQL_MAX_BODY_BYTES: String(8 * 1024) })).post('/graphql').send(body(16 * 1024)).expect(413);
	});

	it('mounts the ceiling where the endpoint is configured, not at the default path', async () => {
		// Review on #10651: Apollo serves `graphqlConfigOptions.path`; the ceiling was mounted at `/graphql` regardless.
		const server = express();
		installBodyParsers(server, { graphqlPath: graphqlEndpointPath('gql'), env: {} });
		server.post('/gql', (req, res) => res.json({ ok: true }));

		await request(server).post('/gql').send(body(GRAPHQL_MAX_BODY_BYTES_DEFAULT + 1024)).expect(413);
	});

	it('resolves the endpoint path the way the driver is given it', () => {
		expect(graphqlEndpointPath(undefined)).toBe('/graphql');
		expect(graphqlEndpointPath('')).toBe('/graphql');
		expect(graphqlEndpointPath('gql')).toBe('/gql');
		expect(graphqlEndpointPath('/gql')).toBe('/gql');
	});

	it('falls back to the default, and reports it, for a value that is not a byte count', () => {
		const warnings: string[] = [];

		expect(resolveGraphqlBodyLimit({ GRAPHQL_MAX_BODY_BYTES: '2mb' }, warnings)).toBe(GRAPHQL_MAX_BODY_BYTES_DEFAULT);
		expect(resolveGraphqlBodyLimit({ GRAPHQL_MAX_BODY_BYTES: '0' }, warnings)).toBe(GRAPHQL_MAX_BODY_BYTES_DEFAULT);
		expect(warnings).toHaveLength(2);
		expect(resolveGraphqlBodyLimit({})).toBe(GRAPHQL_MAX_BODY_BYTES_DEFAULT);
	});
});
