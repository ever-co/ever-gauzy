import { ID } from '@gauzy/contracts';
import { PermissionGuard, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { Controller, Get, HttpStatus, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPluginAccessQuery, GetExpiringSubscriptionsQuery } from '../../application';
import { PluginSubscription } from '../../domain';
import { PluginAccessCheckDTO } from '../../shared';

/**
 * Plugin Subscription Analytics Controller
 * Provides analytics and access verification for plugin subscriptions
 */
@ApiTags('Plugin Subscription Analytics')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/subscriptions/analytics')
export class PluginSubscriptionAnalyticsController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get expiring subscriptions analytics
	 */
	@Get('expiring')
	@ApiOperation({
		summary: 'Get expiring subscriptions',
		description: 'Retrieve subscriptions that are expiring within specified days'
	})
	@ApiQuery({ name: 'days', required: false, description: 'Days until expiry (default: 7)', type: Number })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Expiring subscriptions retrieved successfully',
		type: [PluginSubscription]
	})
	async getExpiringSubscriptions(@Query('days') days?: number): Promise<PluginSubscription[]> {
		return await this.queryBus.execute(new GetExpiringSubscriptionsQuery(days || 7));
	}

	/**
	 * Verify plugin access for current user/tenant
	 */
	@Get('access-verification')
	@ApiOperation({
		summary: 'Verify plugin access',
		description: 'Check if current user/tenant has access to specified plugin'
	})
	@ApiQuery({ name: 'pluginId', required: true, description: 'Plugin ID to check access for', type: String })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin access verification completed',
		schema: {
			type: 'object',
			properties: {
				hasAccess: { type: 'boolean' },
				subscription: { $ref: '#/components/schemas/PluginSubscription' }
			}
		}
	})
	async verifyPluginAccess(
		@Query('pluginId', ParseUUIDPipe) pluginId: ID
	): Promise<{ hasAccess: boolean; subscription?: PluginSubscription }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const accessCheckDto: PluginAccessCheckDTO = { pluginId };

		return await this.queryBus.execute(new CheckPluginAccessQuery(accessCheckDto, tenantId, organizationId));
	}
}
