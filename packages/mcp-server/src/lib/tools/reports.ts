import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { ReportCategoryEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('ReportTools');

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

				const response = await apiClient.get('/api/report', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching reports:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch reports: ${sanitizeErrorMessage(error)}`);
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
				const response = await apiClient.get('/api/report/category');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching report categories:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch report categories: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get report menu items tool
	server.tool(
		'get_report_menu_items',
		'Get report menu items for the organization',
		{
			relations: z.array(z.string()).optional().describe('Relations to include'),
			category: ReportCategoryEnum.optional().describe('Filter by report category'),
			showInMenu: z.boolean().optional().describe('Filter by menu visibility')
		},
		async ({ relations, category, showInMenu }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(relations && { relations }),
					...(category && { category }),
					...(showInMenu !== undefined && { showInMenu })
				};

				const response = await apiClient.get('/api/report/menu-items', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching report menu items:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch report menu items: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update report menu tool
	server.tool(
		'update_report_menu',
		'Update report menu settings for the organization',
		{
			reportId: z.string().uuid().describe('The report ID'),
			isEnabled: z.boolean().describe('Whether to enable or disable the report in menu')
		},
		async ({ reportId, isEnabled }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requestData = {
					reportId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					isEnabled
				};

				const response = await apiClient.post('/api/report/menu-item', requestData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating report menu:', sanitizeForLogging(error));
				throw new Error(`Failed to update report menu: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};
