// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { CommentableTypeEnum } from '../input-schemas';
import { buildListQuery, containsText, pageOf, readAllPages, toApiEntity, validateOrganizationContext } from './utils';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
const logger = new Logger('CommentTools');

/** Comments matching `where` whose text contains `query`, read page by page: the API has no comment search. */
const findCommentsContaining = async (
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	query: string,
	relations?: string[]
) => {
	const comments = await readAllPages<{ comment?: string }>('/api/comment', (page, take) =>
		buildListQuery(defaultParams, where, { page, limit: take, relations })
	);
	return comments.filter(({ comment }) => containsText(comment, query));
};

export const registerCommentTools = (server: McpServer) => {
	// Get comments tool
	registerTool(
		server,
		'get_comments',
		"Get list of comments for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for comment content'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["createdBy", "employee", "parent", "replies"])'),
			entity: CommentableTypeEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			parentId: z.string().uuid().optional().describe('Filter by parent comment ID (for replies)')
		},
		async ({ page = 1, limit = 10, search, relations, entity, entityId, employeeId, parentId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const where = { entity: toApiEntity(entity), entityId, employeeId, parentId };
				const response = search
					? pageOf(await findCommentsContaining(defaultParams, where, search, relations), page, limit)
					: await apiClient.get('/api/comment', {
							params: buildListQuery(defaultParams, where, { page, limit, relations })
						});

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
	registerTool(
		server,
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

				// `/api/comment/count` is read as a comment id: the list route counts them instead
				const params = buildListQuery(
					defaultParams,
					{ entity: toApiEntity(entity), entityId, employeeId, parentId },
					{ limit: 1 }
				);

				const { total } = await apiClient.get<{ total: number }>('/api/comment', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: total }, null, 2)
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
	registerTool(
		server,
		'get_comment',
		'Get a specific comment by ID',
		{
			id: z.string().uuid().describe('The comment ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["createdBy", "employee", "parent", "replies"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/comment/${id}`, { params });

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
	registerTool(
		server,
		'create_comment',
		"Create a new comment in the authenticated user's organization",
		{
			comment_data: z
				.object({
					comment: z.string().describe('The comment text (required)'),
					entity: z.string().describe('The entity type (required)'),
					entityId: z.string().describe('The entity ID (required)')
				})
				.passthrough()
				.describe('The data for creating the comment')
		},
		async ({ comment_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...comment_data,
					entity: toApiEntity(comment_data.entity),
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comment', createData);

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
	registerTool(
		server,
		'update_comment',
		'Update an existing comment',
		{
			id: z.string().uuid().describe('The comment ID'),
			comment_data: z
				.object({
					comment: z.string().describe('The comment text')
				})
				.describe('The data for updating the comment (only comment text can be updated)')
		},
		async ({ id, comment_data }) => {
			try {
				const response = await apiClient.put(`/api/comment/${id}`, comment_data);

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
	registerTool(
		server,
		'delete_comment',
		'Delete a comment',
		{
			id: z.string().uuid().describe('The comment ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/comment/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Comment deleted successfully', id },
								null,
								2
							)
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
	registerTool(
		server,
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

				const where = { entity: toApiEntity(entity), entityId };
				// The API cannot filter on a missing parent: without replies, the root comments are kept here
				const response = includeReplies
					? await apiClient.get('/api/comment', {
							params: buildListQuery(defaultParams, where, { page, limit, relations })
						})
					: pageOf(
							(
								await readAllPages<{ parentId?: string }>('/api/comment', (pageNumber, take) =>
									buildListQuery(defaultParams, where, { page: pageNumber, limit: take, relations })
								)
							).filter(({ parentId }) => !parentId),
							page,
							limit
						);

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
	registerTool(
		server,
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
					entity: toApiEntity(entity),
					entityId,
					parentId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comment', createData);

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
	registerTool(
		server,
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

				const params = buildListQuery(defaultParams, { parentId }, { page, limit, relations });

				const response = await apiClient.get('/api/comment', { params });

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
	registerTool(
		server,
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

				const createdByUserId = authManager.getUserId();
				if (!createdByUserId) {
					throw new Error('User ID not available. Please ensure you are logged in.');
				}
				const params = buildListQuery(
					defaultParams,
					{ entity: toApiEntity(entity), entityId, createdByUserId },
					{ page, limit, relations }
				);

				const response = await apiClient.get('/api/comment', { params });

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
	registerTool(
		server,
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
					entity: toApiEntity(CommentableTypeEnum.enum.TASK),
					entityId: taskId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comment', createData);

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
	registerTool(
		server,
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
					entity: toApiEntity(CommentableTypeEnum.enum.PROJECT),
					entityId: projectId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comment', createData);

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
	registerTool(
		server,
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
					entity: toApiEntity(CommentableTypeEnum.enum.GOAL),
					entityId: goalId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/comment', createData);

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
	registerTool(
		server,
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

				const comments = await findCommentsContaining(
					defaultParams,
					{ entity: toApiEntity(entity), employeeId },
					query
				);
				const response = pageOf(comments, 1, limit);

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
	registerTool(
		server,
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

				const params = buildListQuery(
					defaultParams,
					{ entity: toApiEntity(entity), employeeId },
					{ limit, relations, order: { createdAt: 'DESC' } }
				);

				const response = await apiClient.get('/api/comment', { params });

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
