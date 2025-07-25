/**
 * Central registry of all available MCP tools
 * This file serves as the single source of truth for tool definitions
 * and can be imported wherever tool information is needed.
 */

export interface ToolRegistry {
	[category: string]: string[];
}

/**
 * Complete registry of all available tools organized by category
 */
export const TOOLS_REGISTRY: ToolRegistry = {
	authentication: ['login', 'logout', 'get_auth_status', 'refresh_auth_token', 'auto_login'],
	employees: [
		'get_employees',
		'get_employee_count',
		'get_employees_pagination',
		'get_working_employees',
		'get_working_employees_count',
		'get_organization_members',
		'get_employee',
		'get_employee_statistics',
		'get_current_employee',
		'create_employee',
		'update_employee',
		'update_employee_profile',
		'soft_delete_employee',
		'restore_employee',
		'bulk_create_employees'
	],
	tasks: [
		'get_tasks',
		'get_task_count',
		'get_tasks_pagination',
		'get_tasks_by_employee',
		'get_my_tasks',
		'get_team_tasks',
		'create_task',
		'get_task',
		'update_task',
		'delete_task',
		'bulk_create_tasks',
		'bulk_update_tasks',
		'bulk_delete_tasks',
		'get_task_statistics',
		'assign_task_to_employee',
		'unassign_task_from_employee'
	],
	projects: [
		'get_projects',
		'get_project_count',
		'get_projects_pagination',
		'get_projects_by_employee',
		'get_my_projects',
		'get_project',
		'create_project',
		'update_project',
		'delete_project',
		'bulk_create_projects',
		'bulk_update_projects',
		'bulk_delete_projects',
		'get_project_statistics',
		'assign_project_to_employee',
		'unassign_project_from_employee'
	],
	dailyPlans: [
		'get_daily_plans',
		'get_my_daily_plans',
		'get_team_daily_plans',
		'get_employee_daily_plans',
		'get_daily_plans_for_task',
		'get_daily_plan',
		'create_daily_plan',
		'update_daily_plan',
		'delete_daily_plan',
		'add_task_to_daily_plan',
		'remove_task_from_daily_plan',
		'remove_task_from_many_daily_plans',
		'get_daily_plan_count',
		'get_daily_plan_statistics',
		'bulk_create_daily_plans',
		'bulk_update_daily_plans',
		'bulk_delete_daily_plans'
	],
	organizationContacts: [
		'get_organization_contacts',
		'get_organization_contact_count',
		'get_organization_contacts_pagination',
		'get_organization_contacts_by_employee',
		'get_organization_contact',
		'create_organization_contact',
		'update_organization_contact',
		'update_organization_contact_by_employee',
		'delete_organization_contact',
		'bulk_create_organization_contacts',
		'bulk_update_organization_contacts',
		'bulk_delete_organization_contacts',
		'get_organization_contact_statistics',
		'assign_contact_to_employee',
		'unassign_contact_from_employee',
		'get_contact_projects',
		'invite_organization_contact'
	],
	timer: ['timer_status', 'start_timer', 'stop_timer'],
	test: ['test_api_connection', 'get_server_info', 'test_mcp_capabilities']
};

/**
 * Get all tools in a specific category
 */
export const getToolsByCategory = (category: string): string[] => {
	return TOOLS_REGISTRY[category] || [];
};

/**
 * Get all available categories
 */
export const getToolCategories = (): string[] => {
	return Object.keys(TOOLS_REGISTRY);
};

/**
 * Get tool counts by category
 */
export const getToolCounts = (): Record<string, number> => {
	return Object.keys(TOOLS_REGISTRY).reduce((counts, category) => {
		counts[category] = TOOLS_REGISTRY[category].length;
		return counts;
	}, {} as Record<string, number>);
};

/**
 * Get total number of tools across all categories
 */
export const getTotalToolCount = (): number => {
	return Object.values(TOOLS_REGISTRY).reduce((sum, categoryTools) => sum + categoryTools.length, 0);
};

/**
 * Check if a tool exists in the registry
 */
export const isToolRegistered = (toolName: string): boolean => {
	return Object.values(TOOLS_REGISTRY).some((tools) => tools.includes(toolName));
};

/**
 * Get the category of a specific tool
 */
export const getToolCategory = (toolName: string): string | null => {
	for (const [category, tools] of Object.entries(TOOLS_REGISTRY)) {
		if (tools.includes(toolName)) {
			return category;
		}
	}
	return null;
};

/**
 * Get all tools as a flat array
 */
export const getAllTools = (): string[] => {
	return Object.values(TOOLS_REGISTRY).flat();
};
