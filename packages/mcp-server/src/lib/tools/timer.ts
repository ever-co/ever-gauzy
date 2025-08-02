import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';

const logger = new Logger('TimerTools');

export const registerTimerTools = (server: McpServer) => {
	// Timer status tool
	server.tool(
		'timer_status',
		'Get the current timer status for the authenticated user',
		{}, // No parameters needed - uses authenticated user's context
		async () => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.get('/api/timesheet/timer/status', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching timer status:', error instanceof Error ? error.stack : undefined);
				throw new Error(`Failed to fetch timer status: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	// Start timer tool
	server.tool(
		'start_timer',
		'Start a timer for the authenticated user',
		{
			projectId: z.string().uuid().optional().describe('The project ID to track time for'),
			taskId: z.string().uuid().optional().describe('The task ID to track time for'),
			organizationContactId: z.string().uuid().optional().describe('The contact associated with this timer'),
			organizationTeamId: z.string().uuid().optional().describe('The team associated with this timer'),
			description: z.string().optional().describe('Description for the time entry'),
			logType: z
				.enum(['TRACKED', 'MANUAL', 'RESUMED', 'IDLE', 'VISITED'])
				.optional()
				.describe('Type of time log'),
			source: z
				.enum(['BROWSER', 'DESKTOP', 'MOBILE', 'UPWORK', 'HUBSTAFF', 'TEAMS', 'BROWSER_EXTENSION', 'CLOC'])
				.optional()
				.describe('Source of the timer'),
			isBillable: z.boolean().optional().describe('Whether the time is billable'),
			tags: z.array(z.string()).optional().describe('Tags for the time entry'),
			manualTimeSlot: z.boolean().optional().describe('Whether to use manual time slot')
		},
		async ({
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			description,
			logType,
			source,
			isBillable,
			tags,
			manualTimeSlot
		}) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const startData = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(projectId && { projectId }),
					...(taskId && { taskId }),
					...(organizationContactId && { organizationContactId }),
					...(organizationTeamId && { organizationTeamId }),
					...(description && { description }),
					logType: logType || 'TRACKED',
					source: source || 'BROWSER',
					...(isBillable !== undefined && { isBillable }),
					...(tags && { tags }),
					...(manualTimeSlot !== undefined && { manualTimeSlot })
				};

				const response = await apiClient.post('/api/timesheet/timer/start', startData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error starting timer:', error);
				throw new Error(`Failed to start timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	// Stop timer tool
	server.tool(
		'stop_timer',
		'Stop the running timer for the authenticated user',
		{
			description: z.string().optional().describe('Description for the time entry'),
			source: z
				.enum(['BROWSER', 'DESKTOP', 'MOBILE', 'UPWORK', 'HUBSTAFF', 'TEAMS', 'BROWSER_EXTENSION', 'CLOC'])
				.optional()
				.describe('Source of the timer'),
			manualTimeSlot: z.boolean().optional().describe('Whether to use manual time slot')
		},
		async ({ description, source, manualTimeSlot }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const stopData = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(description && { description }),
					source: source || 'BROWSER',
					...(manualTimeSlot !== undefined && { manualTimeSlot })
				};

				const response = await apiClient.post('/api/timesheet/timer/stop', stopData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error stopping timer:', error);
				throw new Error(`Failed to stop timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);
};
