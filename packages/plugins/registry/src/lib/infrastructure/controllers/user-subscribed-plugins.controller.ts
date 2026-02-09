import { HttpStatus, IPagination, PluginSubscriptionStatus } from '@gauzy/contracts';
import { PermissionGuard, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUserSubscribedPluginsQuery } from '../../application';
import { Plugin } from '../../domain';
import { IPlugin } from '../../shared';

/**
 * User Subscribed Plugins Controller
 * Provides endpoint to retrieve all plugins where the current user has an active subscription
 */
@ApiTags('User Subscribed Plugins')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/subscriptions/me')
export class UserSubscribedPluginsController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get all plugins where the current user has an active subscription
	 */
	@ApiOperation({
		summary: 'Get plugins with user subscription',
		description:
			'Retrieves all plugins where the current authenticated user has an active or trialing subscription. Supports pagination and status filtering.'
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: PluginSubscriptionStatus,
		description: 'Filter by subscription status (defaults to ACTIVE and TRIALING)'
	})
	@ApiQuery({
		name: 'skip',
		required: false,
		type: Number,
		description: 'Number of records to skip for pagination'
	})
	@ApiQuery({
		name: 'take',
		required: false,
		type: Number,
		description: 'Number of records to take for pagination (default: 10)'
	})
	@ApiQuery({
		name: 'relations',
		required: false,
		isArray: true,
		description: 'Additional relations to include in plugin results'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Subscribed plugins retrieved successfully.',
		type: Plugin,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access - user must be authenticated.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Forbidden - insufficient permissions.'
	})
	@Get()
	public async getSubscribedPlugins(
		@Query('status') status?: PluginSubscriptionStatus[],
		@Query('skip') skip?: number,
		@Query('take') take?: number,
		@Query('relations') relations?: string[]
	): Promise<IPagination<IPlugin>> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return this.queryBus.execute(
			new GetUserSubscribedPluginsQuery(userId, tenantId, organizationId, {
				status,
				skip: skip ? Number(skip) : undefined,
				take: take ? Number(take) : undefined,
				relations: relations || []
			})
		);
	}
}
