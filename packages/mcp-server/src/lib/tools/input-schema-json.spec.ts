/**
 * Regression: MCP tools/list converts every tool inputSchema with Zod's toJSONSchema.
 * z.date() throws "Date cannot be represented in JSON Schema" and fails the whole list.
 *
 * Env for mcp-server module load is set in packages/mcp-server/jest.config.ts.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerEmployeeTools } from './employees';
import { registerAllMcpTools } from './register-all-tools';
import { createMcpServer } from '../mcp-server';

/** Floor based on current production tool surface; bump if modules are removed intentionally. */
const MIN_REGISTERED_TOOLS = 300;
const MIN_TOOLS_WITH_INPUT_SCHEMA = 280;

type CapturedTool = {
	name: string;
	inputSchema?: z.ZodTypeAny;
};

type ForRangeDateFields = {
	properties?: {
		forRange?: {
			properties?: {
				startDate?: { type?: string; format?: string };
				endDate?: { type?: string; format?: string };
			};
		};
	};
};

type JsonRpcResponse = {
	jsonrpc: '2.0';
	id?: number | string;
	result?: {
		tools?: Array<{
			name: string;
			inputSchema?: ForRangeDateFields;
		}>;
		serverInfo?: { name?: string };
	};
	error?: { code: number; message: string; data?: unknown };
};

function isZodShape(value: unknown): value is Record<string, z.ZodTypeAny> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectForRangeIsoDateTime(schema: ForRangeDateFields | undefined) {
	expect(schema?.properties?.forRange?.properties?.startDate?.type).toBe('string');
	expect(schema?.properties?.forRange?.properties?.endDate?.type).toBe('string');
	expect(schema?.properties?.forRange?.properties?.startDate?.format).toBe('date-time');
	expect(schema?.properties?.forRange?.properties?.endDate?.format).toBe('date-time');
}

function createCapturingServer(): { server: McpServer; tools: CapturedTool[] } {
	const tools: CapturedTool[] = [];

	const capture = (name: string, inputSchema?: z.ZodTypeAny) => {
		tools.push({ name, inputSchema });
	};

	const server = {
		registerTool: (name: string, config: { inputSchema?: z.ZodTypeAny }) => {
			capture(name, config?.inputSchema);
		},
		/**
		 * Legacy SDK API still used by some modules (e.g. tasks.ts).
		 * Supported:
		 * - tool(name, description, callback) — no input schema
		 * - tool(name, description, paramsShape, callback) — Zod shape object
		 * Anything else throws so schemas cannot be dropped silently.
		 */
		tool: (...args: unknown[]) => {
			const name = String(args[0] ?? '<unknown>');
			const description = args[1];
			const third = args[2];
			const fourth = args[3];

			if (typeof description !== 'string') {
				throw new Error(`Unrecognized server.tool() signature for "${name}": expected description string`);
			}

			if (typeof third === 'function' && fourth === undefined) {
				capture(name);
				return;
			}

			if (isZodShape(third) && typeof fourth === 'function') {
				capture(name, z.object(third));
				return;
			}

			throw new Error(
				`Unrecognized server.tool() signature for "${name}" (argCount=${args.length}). ` +
					'Update the capturing mock — do not silently skip schemas.'
			);
		}
	} as unknown as McpServer;

	return { server, tools };
}

async function waitForJsonRpcResponse(
	transport: InMemoryTransport,
	id: number,
	// Below Jest's default 5s test timeout (@nx/jest/preset) so this message wins on hang.
	timeoutMs = 4000
): Promise<JsonRpcResponse> {
	return await new Promise<JsonRpcResponse>((resolve, reject) => {
		const previous = transport.onmessage;

		const timer = setTimeout(() => {
			transport.onmessage = previous;
			reject(new Error(`Timed out waiting for JSON-RPC response id=${id}`));
		}, timeoutMs);

		transport.onmessage = (message, extra) => {
			if (typeof previous === 'function') {
				previous(message, extra);
			}

			const response = message as JsonRpcResponse;
			if (response?.id === id) {
				clearTimeout(timer);
				transport.onmessage = previous;
				resolve(response);
			}
		};
	});
}

describe('MCP tool input schemas JSON Schema conversion', () => {
	it('converts every registered tool inputSchema via z.toJSONSchema (tools/list path)', () => {
		const { server, tools } = createCapturingServer();
		registerAllMcpTools(server);

		expect(tools.length).toBeGreaterThanOrEqual(MIN_REGISTERED_TOOLS);
		expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);

		const withSchema = tools.filter((tool) => tool.inputSchema);
		expect(withSchema.length).toBeGreaterThanOrEqual(MIN_TOOLS_WITH_INPUT_SCHEMA);

		const failures: string[] = [];

		for (const tool of withSchema) {
			try {
				z.toJSONSchema(tool.inputSchema!, { io: 'input' });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failures.push(`${tool.name}: ${message}`);
			}
		}

		expect(failures).toEqual([]);
	});

	it('converts get_working_employees_count forRange schema (ISO datetime, not Date)', () => {
		const { server, tools } = createCapturingServer();
		registerEmployeeTools(server);

		const countTool = tools.find((t) => t.name === 'get_working_employees_count');
		expect(countTool?.inputSchema).toBeDefined();

		const jsonSchema = z.toJSONSchema(countTool!.inputSchema!, { io: 'input' }) as ForRangeDateFields;
		expectForRangeIsoDateTime(jsonSchema);

		const offsetRange = {
			forRange: {
				startDate: '2026-01-01T00:00:00+05:30',
				endDate: '2026-01-31T23:59:59+05:30'
			}
		};
		expect(countTool!.inputSchema!.safeParse(offsetRange).success).toBe(true);

		const listTool = tools.find((t) => t.name === 'get_working_employees');
		expect(listTool?.inputSchema!.safeParse(offsetRange).success).toBe(true);
	});

	it('lists tools through the production MCP initialize → tools/list protocol path', async () => {
		const { server } = createMcpServer();
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		await server.connect(serverTransport);
		await clientTransport.start();

		try {
			const initializeWait = waitForJsonRpcResponse(clientTransport, 1);
			await clientTransport.send({
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'schema-repro', version: '1' }
				}
			});
			const initializeResponse = await initializeWait;
			expect(initializeResponse.error).toBeUndefined();

			await clientTransport.send({
				jsonrpc: '2.0',
				method: 'notifications/initialized'
			});

			const listWait = waitForJsonRpcResponse(clientTransport, 2);
			await clientTransport.send({
				jsonrpc: '2.0',
				id: 2,
				method: 'tools/list',
				params: {}
			});
			const listResponse = await listWait;

			expect(listResponse.error).toBeUndefined();
			expect(listResponse.result?.tools?.length ?? 0).toBeGreaterThanOrEqual(MIN_REGISTERED_TOOLS);

			const toolNames = (listResponse.result?.tools ?? []).map((tool) => tool.name);
			expect(new Set(toolNames).size).toBe(toolNames.length);

			const countTool = (listResponse.result?.tools ?? []).find(
				(tool) => tool.name === 'get_working_employees_count'
			);
			expect(countTool).toBeDefined();
			expectForRangeIsoDateTime(countTool?.inputSchema);
		} finally {
			await clientTransport.close();
			await server.close();
		}
	});
});
