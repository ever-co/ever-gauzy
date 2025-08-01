import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { ReportSchema, ReportCategoryEnum } from '../schema';

const logger = new Logger('ReportTools');

/**
 * Helper function to validate organization context and return default parameters
 */
const validateOrganizationContext = () => {
	const defaultParams = authManager.getDefaultParams();

	if (!defaultParams.organizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return defaultParams;
};

export const registerReportTools = (server: McpServer) => {
	// Get reports tool
	server.tool(
		'get_reports',
		"Get list of available reports for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for report name or description'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["reportOrganizations"])'),
			category: ReportCategoryEnum.optional().describe('Filter by report category'),
			showInMenu: z.boolean().optional().describe('Filter by menu visibility'),
			enabled: z.boolean().optional().describe('Filter by enabled status for organization')
		},
		async ({ page = 1, limit = 10, search, relations, category, showInMenu, enabled }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(category && { category }),
					...(showInMenu !== undefined && { showInMenu }),
					...(enabled !== undefined && { enabled })
				};

				const response = await apiClient.get('/api/reports', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching reports:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch reports: ${message}`);
			}
		}
	);

	// Get report by ID tool
	server.tool(
		'get_report',
		'Get a specific report by ID',
		{
			id: z.string().uuid().describe('The report ID'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/reports/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching report:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch report: ${message}`);
			}
		}
	);

	// Get report by slug tool
	server.tool(
		'get_report_by_slug',
		'Get a report by its slug identifier',
		{
			slug: z.string().describe('The report slug'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ slug, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					slug,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/reports/by-slug', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching report by slug:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch report by slug: ${message}`);
			}
		}
	);

	// Generate report data tool
	server.tool(
		'generate_report_data',
		'Generate data for a specific report',
		{
			reportId: z.string().uuid().describe('The report ID'),
			filters: z.object({
				startDate: z.string().optional().describe('Start date filter (ISO format)'),
				endDate: z.string().optional().describe('End date filter (ISO format)'),
				employeeIds: z.array(z.string().uuid()).optional().describe('Filter by employee IDs'),
				projectIds: z.array(z.string().uuid()).optional().describe('Filter by project IDs'),
				organizationContactIds: z.array(z.string().uuid()).optional().describe('Filter by client IDs'),
				teamIds: z.array(z.string().uuid()).optional().describe('Filter by team IDs'),
				departmentIds: z.array(z.string().uuid()).optional().describe('Filter by department IDs'),
				status: z.array(z.string()).optional().describe('Filter by status values'),
				currency: z.string().optional().describe('Filter by currency'),
				groupBy: z.string().optional().describe('Group results by field'),
				limit: z.number().optional().describe('Limit number of results')
			}).optional().describe('Report filters and parameters')
		},
		async ({ reportId, filters }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requestData = {
					reportId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(filters && { filters })
				};

				const response = await apiClient.post('/api/reports/generate', requestData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error generating report data:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to generate report data: ${message}`);
			}
		}
	);

	// Get financial reports tool
	server.tool(
		'get_financial_reports',
		'Get financial reports data',
		{
			reportType: z.enum(['INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'PROFIT_LOSS', 'EXPENSE_SUMMARY']).describe('Type of financial report'),
			startDate: z.string().describe('Start date for report (ISO format)'),
			endDate: z.string().describe('End date for report (ISO format)'),
			currency: z.string().optional().describe('Currency for financial calculations'),
			groupBy: z.enum(['MONTH', 'QUARTER', 'YEAR', 'CATEGORY', 'PROJECT', 'CLIENT']).optional().describe('Group financial data by'),
			includeDetails: z.boolean().optional().default(false).describe('Include detailed breakdown')
		},
		async ({ reportType, startDate, endDate, currency, groupBy, includeDetails = false }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					reportType,
					startDate,
					endDate,
					...(currency && { currency }),
					...(groupBy && { groupBy }),
					includeDetails
				};

				const response = await apiClient.get('/api/reports/financial', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching financial reports:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch financial reports: ${message}`);
			}
		}
	);

	// Get time tracking reports tool
	server.tool(
		'get_time_tracking_reports',
		'Get time tracking and productivity reports',
		{
			reportType: z.enum(['TIME_SUMMARY', 'PRODUCTIVITY', 'ATTENDANCE', 'TIMESHEET', 'ACTIVITY']).describe('Type of time tracking report'),
			startDate: z.string().describe('Start date for report (ISO format)'),
			endDate: z.string().describe('End date for report (ISO format)'),
			employeeIds: z.array(z.string().uuid()).optional().describe('Filter by employee IDs'),
			projectIds: z.array(z.string().uuid()).optional().describe('Filter by project IDs'),
			teamIds: z.array(z.string().uuid()).optional().describe('Filter by team IDs'),
			groupBy: z.enum(['DAY', 'WEEK', 'MONTH', 'EMPLOYEE', 'PROJECT', 'TEAM']).optional().describe('Group time data by'),
			includeScreenshots: z.boolean().optional().default(false).describe('Include screenshot data')
		},
		async ({ reportType, startDate, endDate, employeeIds, projectIds, teamIds, groupBy, includeScreenshots = false }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					reportType,
					startDate,
					endDate,
					...(employeeIds && { employeeIds }),
					...(projectIds && { projectIds }),
					...(teamIds && { teamIds }),
					...(groupBy && { groupBy }),
					includeScreenshots
				};

				const response = await apiClient.get('/api/reports/time-tracking', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching time tracking reports:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch time tracking reports: ${message}`);
			}
		}
	);

	// Get project reports tool
	server.tool(
		'get_project_reports',
		'Get project management and performance reports',
		{
			reportType: z.enum(['PROJECT_SUMMARY', 'TASK_COMPLETION', 'RESOURCE_ALLOCATION', 'MILESTONE_PROGRESS', 'BUDGET_ANALYSIS']).describe('Type of project report'),
			startDate: z.string().optional().describe('Start date for report (ISO format)'),
			endDate: z.string().optional().describe('End date for report (ISO format)'),
			projectIds: z.array(z.string().uuid()).optional().describe('Filter by project IDs'),
			employeeIds: z.array(z.string().uuid()).optional().describe('Filter by employee IDs'),
			clientIds: z.array(z.string().uuid()).optional().describe('Filter by client IDs'),
			status: z.array(z.string()).optional().describe('Filter by project/task status'),
			groupBy: z.enum(['PROJECT', 'CLIENT', 'EMPLOYEE', 'STATUS', 'MONTH']).optional().describe('Group project data by')
		},
		async ({ reportType, startDate, endDate, projectIds, employeeIds, clientIds, status, groupBy }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					reportType,
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(projectIds && { projectIds }),
					...(employeeIds && { employeeIds }),
					...(clientIds && { clientIds }),
					...(status && { status }),
					...(groupBy && { groupBy })
				};

				const response = await apiClient.get('/api/reports/projects', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching project reports:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch project reports: ${message}`);
			}
		}
	);

	// Get HR reports tool
	server.tool(
		'get_hr_reports',
		'Get human resources and employee reports',
		{
			reportType: z.enum(['EMPLOYEE_SUMMARY', 'PAYROLL', 'LEAVE_BALANCE', 'PERFORMANCE', 'RECRUITMENT', 'AWARDS']).describe('Type of HR report'),
			startDate: z.string().optional().describe('Start date for report (ISO format)'),
			endDate: z.string().optional().describe('End date for report (ISO format)'),
			employeeIds: z.array(z.string().uuid()).optional().describe('Filter by employee IDs'),
			departmentIds: z.array(z.string().uuid()).optional().describe('Filter by department IDs'),
			positionIds: z.array(z.string().uuid()).optional().describe('Filter by position IDs'),
			status: z.array(z.string()).optional().describe('Filter by employee status'),
			groupBy: z.enum(['DEPARTMENT', 'POSITION', 'EMPLOYEE', 'MONTH', 'STATUS']).optional().describe('Group HR data by')
		},
		async ({ reportType, startDate, endDate, employeeIds, departmentIds, positionIds, status, groupBy }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					reportType,
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(employeeIds && { employeeIds }),
					...(departmentIds && { departmentIds }),
					...(positionIds && { positionIds }),
					...(status && { status }),
					...(groupBy && { groupBy })
				};

				const response = await apiClient.get('/api/reports/hr', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching HR reports:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch HR reports: ${message}`);
			}
		}
	);

	// Get sales reports tool
	server.tool(
		'get_sales_reports',
		'Get sales and CRM reports',
		{
			reportType: z.enum(['SALES_SUMMARY', 'PIPELINE_ANALYSIS', 'CLIENT_REVENUE', 'CONVERSION_RATES', 'DEAL_FORECAST']).describe('Type of sales report'),
			startDate: z.string().describe('Start date for report (ISO format)'),
			endDate: z.string().describe('End date for report (ISO format)'),
			clientIds: z.array(z.string().uuid()).optional().describe('Filter by client IDs'),
			employeeIds: z.array(z.string().uuid()).optional().describe('Filter by sales rep IDs'),
			dealStages: z.array(z.string()).optional().describe('Filter by deal stages'),
			currency: z.string().optional().describe('Currency for revenue calculations'),
			groupBy: z.enum(['CLIENT', 'EMPLOYEE', 'STAGE', 'MONTH', 'QUARTER']).optional().describe('Group sales data by')
		},
		async ({ reportType, startDate, endDate, clientIds, employeeIds, dealStages, currency, groupBy }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					reportType,
					startDate,
					endDate,
					...(clientIds && { clientIds }),
					...(employeeIds && { employeeIds }),
					...(dealStages && { dealStages }),
					...(currency && { currency }),
					...(groupBy && { groupBy })
				};

				const response = await apiClient.get('/api/reports/sales', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching sales reports:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch sales reports: ${message}`);
			}
		}
	);

	// Export report tool
	server.tool(
		'export_report',
		'Export report data to various formats',
		{
			reportId: z.string().uuid().describe('The report ID'),
			format: z.enum(['CSV', 'EXCEL', 'PDF', 'JSON']).describe('Export format'),
			filters: z.object({
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				employeeIds: z.array(z.string().uuid()).optional(),
				projectIds: z.array(z.string().uuid()).optional()
			}).optional().describe('Report filters'),
			includeCharts: z.boolean().optional().default(false).describe('Include charts in export (PDF only)')
		},
		async ({ reportId, format, filters, includeCharts = false }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requestData = {
					reportId,
					format,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(filters && { filters }),
					includeCharts
				};

				const response = await apiClient.post('/api/reports/export', requestData, {
					responseType: format === 'JSON' ? 'json' : 'blob'
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								success: true,
								message: `Report exported successfully in ${format} format`,
								reportId,
								format,
								size: (response as any).size || 'Unknown'
							}, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error exporting report:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to export report: ${message}`);
			}
		}
	);

	// Get report categories tool
	server.tool(
		'get_report_categories',
		'Get available report categories',
		{},
		async () => {
			try {
				const response = await apiClient.get('/api/reports/categories');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching report categories:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch report categories: ${message}`);
			}
		}
	);

	// Enable/disable report for organization tool
	server.tool(
		'toggle_report_for_organization',
		'Enable or disable a report for the organization',
		{
			reportId: z.string().uuid().describe('The report ID'),
			enabled: z.boolean().describe('Whether to enable or disable the report')
		},
		async ({ reportId, enabled }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requestData = {
					reportId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					isEnabled: enabled
				};

				const response = await apiClient.put('/api/reports/organization-settings', requestData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error toggling report for organization:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to toggle report for organization: ${message}`);
			}
		}
	);

	// Get organization report settings tool
	server.tool(
		'get_organization_report_settings',
		"Get report settings for the authenticated user's organization",
		{},
		async () => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.get('/api/reports/organization-settings', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching organization report settings:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch organization report settings: ${message}`);
			}
		}
	);
};
