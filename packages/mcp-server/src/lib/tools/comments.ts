import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { CommentSchema, CommentableTypeEnum } from '../schema';
import { validateOrganizationContext } from './utils';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('CommentTools');


export const registerCommentTools = (server: McpServer) => {
	// Get comments tool
	server.tool(
		'get_comments',
		"Get list of comments for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for comment content'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["createdBy", "employee", "parent", "replies"])'),
			entity: CommentableTypeEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			parentId: z.string().uuid().optional().describe('Filter by parent comment ID (for replies)')
		},
		async ({ page = 1, limit = 10, search, relations, entity, entityId, employeeId, parentId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(employeeId && { employeeId }),
					...(parentId && { parentId })
				};

				const response = await apiClient.get('/api/comments', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching comments:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch comments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get comment count tool
	server.tool(
		'get_comment_count',
		"Get comment count in the authenticated user's organization",
		{
			entity: CommentableTypeEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			parentId: z.string().uuid().optional().describe('Filter by parent comment ID')
		},
		async ({ entity, entityId, employeeId, parentId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(employeeId && { employeeId }),
					...(parentId && { parentId })
				};

				const response = await apiClient.get('/api/comments/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching comment count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch comment count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get comment by ID tool
	server.tool(
		'get_comment',
		'Get a specific comment by ID',
		{
			id: z.string().uuid().describe('The comment ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["createdBy", "employee", "parent", "replies"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/comments/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching comment:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch comment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create comment tool
	server.tool(
		'create_comment',
		"Create a new comment in the authenticated user's organization",
		{
			comment_data: CommentSchema.partial()
				.required({
					comment: true,
					entity: true,
					entityId: true
				})
				.describe('The data for creating the comment')
		},
		async ({ comment_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...comment_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comments', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating comment:', sanitizeForLogging(error));
				throw new Error(`Failed to create comment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update comment tool
	server.tool(
		'update_comment',
		'Update an existing comment',
		{
			id: z.string().uuid().describe('The comment ID'),
			comment_data: CommentSchema.partial()
				.pick({ comment: true })
				.describe('The data for updating the comment (only comment text can be updated)')
		},
		async ({ id, comment_data }) => {
			try {
				const response = await apiClient.put(`/api/comments/${id}`, comment_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating comment:', sanitizeForLogging(error));
				throw new Error(`Failed to update comment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete comment tool
	server.tool(
		'delete_comment',
		'Delete a comment',
		{
			id: z.string().uuid().describe('The comment ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/comments/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Comment deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting comment:', sanitizeForLogging(error));
				throw new Error(`Failed to delete comment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get comments by entity tool
	server.tool(
		'get_comments_by_entity',
		'Get all comments for a specific entity',
		{
			entity: CommentableTypeEnum.describe('The entity type'),
			entityId: z.string().uuid().describe('The entity ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			includeReplies: z.boolean().optional().default(true).describe('Include reply comments')
		},
		async ({ entity, entityId, page = 1, limit = 10, relations, includeReplies = true }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					entity,
					entityId,
					page,
					limit,
					...(relations && { relations }),
					includeReplies
				};

				const response = await apiClient.get('/api/comments', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching comments by entity:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch comments by entity: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Reply to comment tool
	server.tool(
		'reply_to_comment',
		'Reply to an existing comment',
		{
			parentId: z.string().uuid().describe('The parent comment ID'),
			comment: z.string().describe('The reply comment text'),
			entity: CommentableTypeEnum.describe('The entity type'),
			entityId: z.string().uuid().describe('The entity ID')
		},
		async ({ parentId, comment, entity, entityId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					comment,
					entity,
					entityId,
					parentId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comments', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error replying to comment:', sanitizeForLogging(error));
				throw new Error(`Failed to reply to comment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get comment replies tool
	server.tool(
		'get_comment_replies',
		'Get all replies to a specific comment',
		{
			parentId: z.string().uuid().describe('The parent comment ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ parentId, page = 1, limit = 10, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					parentId,
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/comments', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching comment replies:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch comment replies: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my comments tool
	server.tool(
		'get_my_comments',
		'Get comments created by the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			entity: CommentableTypeEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, entity, entityId, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/comments/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my comments:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my comments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Add comment to task tool
	server.tool(
		'add_comment_to_task',
		'Add a comment to a specific task',
		{
			taskId: z.string().uuid().describe('The task ID'),
			comment: z.string().describe('The comment text')
		},
		async ({ taskId, comment }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					comment,
					entity: CommentableTypeEnum.enum.TASK,
					entityId: taskId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comments', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding comment to task:', sanitizeForLogging(error));
				throw new Error(`Failed to add comment to task: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Add comment to project tool
	server.tool(
		'add_comment_to_project',
		'Add a comment to a specific project',
		{
			projectId: z.string().uuid().describe('The project ID'),
			comment: z.string().describe('The comment text')
		},
		async ({ projectId, comment }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					comment,
					entity: CommentableTypeEnum.enum.PROJECT,
					entityId: projectId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comments', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding comment to project:', sanitizeForLogging(error));
				throw new Error(`Failed to add comment to project: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Add comment to goal tool
	server.tool(
		'add_comment_to_goal',
		'Add a comment to a specific goal',
		{
			goalId: z.string().uuid().describe('The goal ID'),
			comment: z.string().describe('The comment text')
		},
		async ({ goalId, comment }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					comment,
					entity: CommentableTypeEnum.enum.GOAL,
					entityId: goalId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comments', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding comment to goal:', sanitizeForLogging(error));
				throw new Error(`Failed to add comment to goal: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search comments tool
	server.tool(
		'search_comments',
		'Search comments by content',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			entity: CommentableTypeEnum.optional().describe('Filter by entity type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID')
		},
		async ({ query, limit = 20, entity, employeeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(entity && { entity }),
					...(employeeId && { employeeId })
				};

				const response = await apiClient.get('/api/comments/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching comments:', sanitizeForLogging(error));
				throw new Error(`Failed to search comments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get recent comments tool
	server.tool(
		'get_recent_comments',
		"Get recent comments for the authenticated user's organization",
		{
			limit: z.number().optional().default(20).describe('Maximum number of recent comments'),
			entity: CommentableTypeEnum.optional().describe('Filter by entity type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ limit = 20, entity, employeeId, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					sortBy: 'createdAt',
					sortOrder: 'DESC',
					...(entity && { entity }),
					...(employeeId && { employeeId }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/comments/recent', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching recent comments:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch recent comments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};
