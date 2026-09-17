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

/**
 * Register every MCP tool module on the given server.
 * Shared by production server bootstrap and schema regression tests.
 */
export function registerAllMcpTools(server: McpServer, sessionId?: string): void {
	registerAuthTools(server, sessionId);
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
