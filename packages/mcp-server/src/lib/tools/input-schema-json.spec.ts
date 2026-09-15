/**
 * Regression: MCP tools/list converts every tool inputSchema with Zod's toJSONSchema.
 * z.date() throws "Date cannot be represented in JSON Schema" and fails the whole list.
 *
 * Env for mcp-server module load is set in packages/mcp-server/jest.config.ts.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEmployeeTools } from './employees';
import { registerAllMcpTools } from './register-all-tools';

/** Floor based on current production tool surface; bump if modules are removed intentionally. */
const MIN_REGISTERED_TOOLS = 300;
const MIN_TOOLS_WITH_INPUT_SCHEMA = 280;

type CapturedTool = {
	name: string;
	inputSchema?: z.ZodTypeAny;
};

function isZodShape(value: unknown): value is Record<string, z.ZodTypeAny> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createCapturingServer(): { server: McpServer; tools: CapturedTool[] } {
	let tools: CapturedTool[] = [];

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

describe('MCP tool input schemas JSON Schema conversion', () => {
	it('converts every registered tool inputSchema via z.toJSONSchema (tools/list path)', () => {
		const { server, tools } = createCapturingServer();
		registerAllMcpTools(server);

		expect(tools.length).toBeGreaterThanOrEqual(MIN_REGISTERED_TOOLS);
		expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);

		const withSchema = tools.filter((tool) => tool.inputSchema);
		expect(withSchema.length).toBeGreaterThanOrEqual(MIN_TOOLS_WITH_INPUT_SCHEMA);

		let failures: string[] = [];

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

		const jsonSchema = z.toJSONSchema(countTool!.inputSchema!, { io: 'input' }) as {
			properties?: {
				forRange?: {
					properties?: {
						startDate?: { type?: string };
						endDate?: { type?: string };
					};
				};
			};
		};

		expect(jsonSchema.properties?.forRange?.properties?.startDate?.type).toBe('string');
		expect(jsonSchema.properties?.forRange?.properties?.endDate?.type).toBe('string');
	});
});
