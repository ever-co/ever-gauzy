/**
 * Over HTTP and WebSocket, tools/list is answered from ExtendedMcpServer.listTools(). It converted the Zod 4 input
 * schemas with zod-to-json-schema, which only reads Zod 3: the tools of `registerTool` were listed with an empty
 * `$ref` definition, and the tools of `tool()` with the Zod internals of the object the SDK builds from their shape.
 * An assistant connected over HTTP or WebSocket saw every tool without its parameters. listTools() now lists the
 * schema the SDK lists over stdio.
 *
 * Env for mcp-server module load is set in src/test-setup.ts.
 */
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer, ExtendedMcpServer, ToolDescriptor } from './mcp-server';
import { HttpTransport } from './transports/http-transport';
import { WebSocketTransport } from './transports/websocket-transport';

const DRAFT_07 = 'http://json-schema.org/draft-07/schema#';

type ListedSchema = { properties?: Record<string, unknown>; required?: string[] };

type JsonRpcAnswer = { result?: { tools?: ToolDescriptor[] } };

type AnswerSink = {
	start(): Promise<void>;
	close(): Promise<void>;
	send(answer: JsonRpcAnswer): void;
};

/** The private request router both transports share the shape of: tools/list is answered through it. */
type RoutesMcpRequests = {
	routeMcpRequest(
		method: string,
		params: Record<string, unknown>,
		id: number,
		sink: AnswerSink,
		context: unknown
	): Promise<void>;
};

/** What an assistant reads of a tool's inputSchema: its parameters and the ones it must send. */
function parametersOf(schema: ListedSchema | undefined) {
	return {
		properties: schema?.properties ?? {},
		required: schema?.required ?? []
	};
}

/** The tools the SDK itself lists, through its own tools/list handler: the stdio path. */
async function listedOverStdio(server: ExtendedMcpServer) {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	const client = new Client({ name: 'list-tools-spec', version: '1.0.0' });
	await client.connect(clientTransport);
	const { tools } = await client.listTools();
	await client.close();
	return tools;
}

/** The transports are built without their constructor: only the request router and the server are needed. */
function httpTransportOf(server: ExtendedMcpServer): RoutesMcpRequests {
	const transport = Object.create(HttpTransport.prototype);
	return Object.assign(transport, { mcpServer: server });
}

function webSocketTransportOf(server: ExtendedMcpServer): RoutesMcpRequests {
	const transport = Object.create(WebSocketTransport.prototype);
	return Object.assign(transport, { mcpServer: server, cachedTools: null, cacheTimestamp: 0, CACHE_TTL: 60_000 });
}

async function listedThrough(transport: RoutesMcpRequests, context: unknown): Promise<ToolDescriptor[]> {
	const answers: JsonRpcAnswer[] = [];
	const sink: AnswerSink = {
		start: async () => undefined,
		close: async () => undefined,
		send: (answer) => {
			answers.push(answer);
		}
	};
	await transport.routeMcpRequest('tools/list', {}, 1, sink, context);
	return answers[0]?.result?.tools ?? [];
}

function noOutput() {
	return { content: [] };
}

describe('ExtendedMcpServer.listTools — the input schemas of the HTTP and WebSocket tools/list', () => {
	it('lists every tool with the parameters the SDK lists over stdio', async () => {
		const { server } = createMcpServer();
		try {
			const stdioTools = await listedOverStdio(server);
			const listed = new Map((await server.listTools()).map((tool) => [tool.name, tool]));

			expect(stdioTools.length).toBeGreaterThanOrEqual(300);
			const missing = stdioTools.filter((tool) => !listed.has(tool.name)).map((tool) => tool.name);
			expect(missing).toEqual([]);

			const different = stdioTools
				.filter((tool) => {
					const overStdio = parametersOf(tool.inputSchema);
					const overHttp = parametersOf(listed.get(tool.name)?.inputSchema);
					return !isDeepStrictEqual(overHttp, overStdio);
				})
				.map((tool) => tool.name);
			expect(different).toEqual([]);
		} finally {
			await server.close();
		}
	});

	it('lists the tools of tool() and of registerTool as draft-07 objects with their parameters', async () => {
		const { server } = createMcpServer();
		const listed = await server.listTools();
		const getTask = listed.find((tool) => tool.name === 'get_task');
		const stopTimer = listed.find((tool) => tool.name === 'stop_timer');

		expect(getTask?.inputSchema).toMatchObject({ $schema: DRAFT_07, type: 'object', required: ['id'] });
		expect(Object.keys(getTask?.inputSchema.properties ?? {})).toEqual(['id', 'relations']);
		expect(stopTimer?.inputSchema).toMatchObject({ $schema: DRAFT_07, type: 'object' });
		expect(Object.keys(stopTimer?.inputSchema.properties ?? {})).toEqual([
			'description',
			'source',
			'manualTimeSlot'
		]);
	});

	it('gives a schema z.toJSONSchema cannot represent the empty schema, for its tool only', async () => {
		const server = new ExtendedMcpServer(
			{ name: 'list-tools-spec', version: '1.0.0' },
			{ capabilities: { tools: {} } }
		);
		server.registerTool('plan_day', { description: 'Takes a Date', inputSchema: { day: z.date() } }, noOutput);
		server.registerTool(
			'find_member',
			{ description: 'Takes a name', inputSchema: { name: z.string() } },
			noOutput
		);

		const listed = await server.listTools();

		expect(listed.find((tool) => tool.name === 'plan_day')?.inputSchema).toEqual({
			type: 'object',
			properties: {},
			required: [],
			additionalProperties: false
		});
		expect(parametersOf(listed.find((tool) => tool.name === 'find_member')?.inputSchema)).toEqual({
			properties: { name: { type: 'string' } },
			required: ['name']
		});
	});

	it.each([
		['HTTP', httpTransportOf, undefined],
		['WebSocket', webSocketTransportOf, {}]
	])('answers tools/list over %s with the parameters of each tool', async (_name, transportOf, context) => {
		const { server } = createMcpServer();
		const tools = await listedThrough(transportOf(server), context);
		const getTask = tools.find((tool) => tool.name === 'get_task');

		expect(tools.length).toBeGreaterThanOrEqual(300);
		expect(parametersOf(getTask?.inputSchema).required).toEqual(['id']);
		expect(Object.keys(parametersOf(getTask?.inputSchema).properties)).toEqual(['id', 'relations']);
	});
});
