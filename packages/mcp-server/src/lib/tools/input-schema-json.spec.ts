/**
 * Regression: MCP tools/list converts every tool inputSchema with Zod's toJSONSchema.
 * z.date() throws "Date cannot be represented in JSON Schema" and fails the whole list.
 *
 * Env for mcp-server module load is set in packages/mcp-server/jest.config.ts.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAuthTools } from './auth';
import { registerTimerTools } from './timer';
import { registerProjectTools } from './projects';
import { registerTaskTools } from './tasks';
import { registerEmployeeTools } from './employees';
import { registerDailyPlanTools } from './daily-plan';
import { registerOrganizationContactTools } from './organization-contact';
import { registerTestTools } from './test-connection';
import { registerProductTools } from './products';
import { registerProductCategoryTools } from './product-categories';
import { registerInvoiceTools } from './invoices';
import { registerExpenseTools } from './expenses';
import { registerGoalTools } from './goals';
import { registerKeyResultTools } from './key-results';
import { registerDealTools } from './deals';
import { registerCandidateTools } from './candidates';
import { registerPaymentTools } from './payments';
import { registerMerchantTools } from './merchants';
import { registerIncomeTools } from './incomes';
import { registerEquipmentTools } from './equipment';
import { registerCommentTools } from './comments';
import { registerReportTools } from './reports';
import { registerTimeOffTools } from './time-off';
import { registerEmployeeAwardTools } from './employee-awards';
import { registerActivityLogTools } from './activity-logs';
import { registerWarehouseTools } from './warehouses';
import { registerPipelineTools } from './pipelines';
import { registerSkillTools } from './skills';

type CapturedTool = {
	name: string;
	inputSchema?: z.ZodTypeAny;
};

function createCapturingServer(): { server: McpServer; tools: CapturedTool[] } {
	const tools: CapturedTool[] = [];

	const capture = (name: string, inputSchema?: z.ZodTypeAny) => {
		tools.push({ name, inputSchema });
	};

	const server = {
		registerTool: (name: string, config: { inputSchema?: z.ZodTypeAny }) => {
			capture(name, config?.inputSchema);
		},
		// Legacy SDK API still used by some modules (e.g. tasks.ts)
		tool: (...args: unknown[]) => {
			const name = args[0] as string;
			const schemaOrHandler = args[2];
			const maybeHandler = args[3];

			if (
				schemaOrHandler &&
				typeof schemaOrHandler === 'object' &&
				typeof maybeHandler === 'function'
			) {
				capture(name, z.object(schemaOrHandler as Record<string, z.ZodTypeAny>));
				return;
			}

			capture(name);
		}
	} as unknown as McpServer;

	return { server, tools };
}

function registerAllTools(server: McpServer): void {
	registerAuthTools(server);
	registerTimerTools(server);
	registerProjectTools(server);
	registerTaskTools(server);
	registerEmployeeTools(server);
	registerDailyPlanTools(server);
	registerOrganizationContactTools(server);
	registerTestTools(server);
	registerProductTools(server);
	registerProductCategoryTools(server);
	registerInvoiceTools(server);
	registerExpenseTools(server);
	registerGoalTools(server);
	registerKeyResultTools(server);
	registerDealTools(server);
	registerCandidateTools(server);
	registerPaymentTools(server);
	registerMerchantTools(server);
	registerIncomeTools(server);
	registerEquipmentTools(server);
	registerCommentTools(server);
	registerReportTools(server);
	registerTimeOffTools(server);
	registerEmployeeAwardTools(server);
	registerActivityLogTools(server);
	registerWarehouseTools(server);
	registerPipelineTools(server);
	registerSkillTools(server);
}

describe('MCP tool input schemas JSON Schema conversion', () => {
	it('converts every registered tool inputSchema via z.toJSONSchema (tools/list path)', () => {
		const { server, tools } = createCapturingServer();
		registerAllTools(server);

		expect(tools.length).toBeGreaterThan(0);

		const failures: string[] = [];

		for (const tool of tools) {
			if (!tool.inputSchema) {
				continue;
			}

			try {
				z.toJSONSchema(tool.inputSchema, { io: 'input' });
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
						start?: { type?: string };
						end?: { type?: string };
					};
				};
			};
		};

		expect(jsonSchema.properties?.forRange?.properties?.start?.type).toBe('string');
		expect(jsonSchema.properties?.forRange?.properties?.end?.type).toBe('string');
	});
});
