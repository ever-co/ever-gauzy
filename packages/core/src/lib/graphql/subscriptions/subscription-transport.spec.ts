import { buildSchema } from 'graphql';
import { CloseCode, GRAPHQL_TRANSPORT_WS_PROTOCOL, makeServer } from 'graphql-ws';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { createGraphqlLimitRules } from '../graphql-limits';
import {
	SUBSCRIPTION_HEADERS_KEY,
	acceptSubscriptionConnection,
	createSubscriptionServerOptions,
	graphqlContextArguments,
	subscriptionConnectionHeaders
} from './subscription-transport';

/**
 * The subscription socket is a second way into the one endpoint, so these cases run the options this
 * file produces through `graphql-ws` itself and ask what the HTTP transport would have answered.
 */
describe('the subscription transport', () => {
	const schema = buildSchema('type Query { hello: String }');
	const roots = { query: { hello: () => 'world' } };
	/** The policy of a deployment that does not publish its schema. */
	const validationRules = createGraphqlLimitRules({
		introspection: false,
		maxDepth: 12,
		maxComplexity: 5000,
		maxAliases: 50
	});

	/**
	 * Opens one connection on a `graphql-ws` server built from the given options.
	 *
	 * @param options The server options under test.
	 * @returns The messages the server sent, how it closed the socket, and a way to talk to it.
	 */
	const connect = (options: Record<string, unknown>) => {
		const sent: any[] = [];
		const closed: { code?: number; reason?: string } = {};
		let receive: (data: string) => Promise<void> = async () => undefined;

		const server = makeServer({ schema, roots, ...options } as any);
		const release = server.opened(
			{
				protocol: GRAPHQL_TRANSPORT_WS_PROTOCOL,
				send: async (data: string) => {
					sent.push(JSON.parse(data));
				},
				close: (code?: number, reason?: string) => {
					closed.code = code;
					closed.reason = reason;
				},
				onMessage: (callback: (data: string) => Promise<void>) => {
					receive = callback;
				}
			},
			{ request: { headers: {} } }
		);

		return {
			sent,
			closed,
			send: (message: unknown) => receive(JSON.stringify(message)),
			release: () => release(1000, 'done')
		};
	};

	describe('a connection', () => {
		it('is closed at connection_init when it presents no credential', async () => {
			const socket = connect(createSubscriptionServerOptions({ validationRules }));

			await socket.send({ type: 'connection_init', payload: {} });
			await socket.release();

			expect(socket.closed.code).toBe(CloseCode.Forbidden);
			expect(socket.sent).toEqual([]);
		});

		it('is acknowledged when it presents a bearer token in its parameters', async () => {
			const socket = connect(createSubscriptionServerOptions({ validationRules }));

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer token' } });
			await socket.release();

			expect(socket.closed.code).toBeUndefined();
			expect(socket.sent).toEqual([{ type: 'connection_ack' }]);
		});
	});

	describe('an operation on an accepted connection', () => {
		it('is refused introspection where the deployment does not publish its schema', async () => {
			const socket = connect(createSubscriptionServerOptions({ validationRules }));

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer token' } });
			await socket.send({ id: '1', type: 'subscribe', payload: { query: '{ __schema { queryType { name } } }' } });
			await socket.release();

			const answer = socket.sent.find((message) => message.id === '1');

			// graphql-js answers introspection itself, so no guard ever sees it: before the socket was
			// given the HTTP transport's rules this answered the whole schema.
			expect(answer?.type).toBe('error');
			expect(answer?.payload?.[0]?.extensions?.code).toBe(ApiErrorCode.GRAPHQL_INTROSPECTION_DISABLED);
		});

		it('is executed when it is within the rules', async () => {
			const socket = connect(createSubscriptionServerOptions({ validationRules }));

			await socket.send({ type: 'connection_init', payload: { Authorization: 'Bearer token' } });
			await socket.send({ id: '1', type: 'subscribe', payload: { query: '{ hello }' } });
			await socket.release();

			expect(socket.sent.filter((message) => message.id === '1')).toEqual([
				{ id: '1', type: 'next', payload: { data: { hello: 'world' } } },
				{ id: '1', type: 'complete' }
			]);
		});
	});

	describe('subscriptionConnectionHeaders', () => {
		it('lets a connection parameter override the upgrade request, and reads only the names it knows', () => {
			expect(
				subscriptionConnectionHeaders(
					{ Authorization: 'Bearer from-params', 'Tenant-Id': 't', Cookie: 'c', 'x-forwarded-for': 'x' },
					{ authorization: 'Bearer from-upgrade', 'x-channel-id': ['web', 'pos'] }
				)
			).toEqual({ authorization: 'Bearer from-params', 'tenant-id': 't', 'x-channel-id': 'web' });
		});
	});

	describe('acceptSubscriptionConnection', () => {
		it('counts a complete key pair as a credential and half of one as none', () => {
			expect(acceptSubscriptionConnection({ connectionParams: { 'X-APP-ID': 'id', 'X-API-KEY': 'key' }, extra: {} })).toBe(
				true
			);
			expect(acceptSubscriptionConnection({ connectionParams: { 'X-APP-ID': 'id' }, extra: {} })).toBe(false);
		});

		it('accepts a credential a non-browser client put on the upgrade request', () => {
			expect(
				acceptSubscriptionConnection({ extra: { request: { headers: { authorization: 'Bearer token' } } } })
			).toBe(true);
		});

		it('keeps what it read on the connection, for every operation the socket carries', () => {
			const extra: Record<string, unknown> = {};

			acceptSubscriptionConnection({ connectionParams: { authorization: 'Bearer token' }, extra });

			expect(extra[SUBSCRIPTION_HEADERS_KEY]).toEqual({ authorization: 'Bearer token' });
		});
	});

	describe('graphqlContextArguments', () => {
		it('passes an HTTP operation’s request through untouched', () => {
			const req = { headers: { authorization: 'Bearer token' } };

			expect(graphqlContextArguments({ req, res: {} })).toEqual({ req });
		});

		it('gives a socket operation a request the guards can authenticate', () => {
			const args = graphqlContextArguments({
				connectionParams: { Authorization: 'Bearer token' },
				extra: { request: { headers: { 'tenant-id': 't' } } }
			});
			const req = args.req as { headers: Record<string, string>; header: (name: string) => string | undefined };

			expect(req.headers).toEqual({ authorization: 'Bearer token', 'tenant-id': 't' });
			expect(req.header('Tenant-Id')).toBe('t');
			expect(args.headers).toEqual({ authorization: 'Bearer token', 'tenant-id': 't' });
		});

		it('reuses the headers the connection was accepted with', () => {
			const extra = { [SUBSCRIPTION_HEADERS_KEY]: { authorization: 'Bearer accepted' } };

			expect(graphqlContextArguments({ connectionParams: { authorization: 'Bearer later' }, extra }).headers).toEqual({
				authorization: 'Bearer accepted'
			});
		});

		it('leaves a shape it does not know to the driver', () => {
			expect(graphqlContextArguments(undefined)).toEqual({});
		});
	});
});
