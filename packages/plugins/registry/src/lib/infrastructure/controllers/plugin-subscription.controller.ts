import { PermissionsEnum, PluginSubscriptionStatus } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CancelPluginSubscriptionCommand,
	DeletePluginSubscriptionCommand,
	DowngradePluginSubscriptionCommand,
	GetActivePluginSubscriptionQuery,
	GetPluginSubscriptionByIdQuery,
	GetPluginSubscriptionsByPluginIdQuery,
	GetPluginSubscriptionsBySubscriberIdQuery,
	PurchasePluginSubscriptionCommand,
	RenewPluginSubscriptionCommand,
	UpdatePluginSubscriptionCommand,
	UpgradePluginSubscriptionCommand
} from '../../application';
import { PluginSubscription } from '../../domain';
import { PluginSubscriptionQueryDTO, PurchasePluginSubscriptionDTO, UpdatePluginSubscriptionDTO } from '../../shared';

@ApiTags('Plugin Subscriptions')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/:pluginId/subscriptions')
export class PluginSubscriptionController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({ summary: 'Create plugin subscription' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin subscription created successfully',
		type: PluginSubscription
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	async create(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() purchaseDto: PurchasePluginSubscriptionDTO
	): Promise<PluginSubscription> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const user = RequestContext.currentUser();

		// Use the purchase command for creating subscriptions
		return await this.commandBus.execute(
			new PurchasePluginSubscriptionCommand({ ...purchaseDto, pluginId }, tenantId, organizationId, user?.id)
		);
	}

	@ApiOperation({ summary: 'Get all plugin subscriptions' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiQuery({ name: 'status', required: false, description: 'Filter by subscription status' })
	@ApiQuery({ name: 'subscriberId', required: false, description: 'Filter by subscriber ID' })
	@ApiQuery({ name: 'expiring', required: false, description: 'Show only expiring subscriptions', type: Boolean })
	@ApiQuery({ name: 'days', required: false, description: 'Days until expiry (default: 7)', type: Number })
	@ApiQuery({ name: 'active', required: false, description: 'Show only active subscriptions', type: Boolean })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscriptions retrieved successfully',
		type: [PluginSubscription]
	})
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get()
	async findAll(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Query() query: PluginSubscriptionQueryDTO,
		@Query('expiring') expiring?: boolean,
		@Query('days') days?: number,
		@Query('active') active?: boolean,
		@Query('relations') relations: string[] = ['plugin', 'pluginTenant', 'subscriber', 'plan']
	): Promise<PluginSubscription[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const subscriberId = query.subscriberId || RequestContext.currentUserId();

		// Note: Access checks and expiring subscriptions analytics have been moved to
		// plugin-subscription-analytics.controller.ts for better separation of concerns

		// Handle active subscription filter
		if (active) {
			const activeSubscription = await this.queryBus.execute(
				new GetActivePluginSubscriptionQuery(pluginId, tenantId, organizationId, query.subscriberId)
			);
			return activeSubscription ? [activeSubscription] : [];
		}

		// Handle subscriber filter
		if (subscriberId) {
			return await this.queryBus.execute(
				new GetPluginSubscriptionsBySubscriberIdQuery(subscriberId, [
					'plugin',
					'pluginTenant',
					'subscriber',
					'plan',
					...relations
				])
			);
		}

		// Default: get subscriptions for this plugin
		return await this.queryBus.execute(
			new GetPluginSubscriptionsByPluginIdQuery(pluginId, [
				'plugin',
				'pluginTenant',
				'subscriber',
				'plan',
				...relations
			])
		);
	}

	@ApiOperation({ summary: "Get current user's active subscription for plugin" })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: "Current user's active plugin subscription retrieved successfully",
		type: PluginSubscription
	})
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('me')
	async getCurrentSubscription(
		@Param('pluginId', ParseUUIDPipe) pluginId: string
	): Promise<PluginSubscription | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const subscriberId = RequestContext.currentUserId();

		return this.queryBus.execute(
			new GetActivePluginSubscriptionQuery(pluginId, tenantId, organizationId, subscriberId)
		);
	}

	@ApiOperation({ summary: 'Get plugin subscription by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription retrieved successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get(':id')
	async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PluginSubscription> {
		return await this.queryBus.execute(
			new GetPluginSubscriptionByIdQuery(id, ['plugin', 'pluginTenant', 'subscriber'])
		);
	}

	@ApiOperation({ summary: 'Update plugin subscription status' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription updated successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin subscription ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Patch(':id')
	async updateStatus(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateDto: { status: 'cancelled' | 'renewed' | 'active' | 'expired' | 'suspended'; reason?: string }
	): Promise<PluginSubscription> {
		if (updateDto.status === 'cancelled') {
			return await this.commandBus.execute(new CancelPluginSubscriptionCommand(id, updateDto.reason));
		} else if (updateDto.status === 'renewed') {
			return await this.commandBus.execute(new RenewPluginSubscriptionCommand(id));
		} else {
			// For other status updates, use UpdatePluginSubscriptionCommand with minimal data
			const updateData: Partial<UpdatePluginSubscriptionDTO> = {};
			if (updateDto.status === 'active') {
				updateData.status = PluginSubscriptionStatus.ACTIVE;
			} else if (updateDto.status === 'expired') {
				updateData.status = PluginSubscriptionStatus.EXPIRED;
			} else if (updateDto.status === 'suspended') {
				updateData.status = PluginSubscriptionStatus.SUSPENDED;
			}
			return await this.commandBus.execute(
				new UpdatePluginSubscriptionCommand(id, updateData as UpdatePluginSubscriptionDTO)
			);
		}
	}

	@ApiOperation({ summary: 'Update plugin subscription' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription updated successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id')
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateDto: UpdatePluginSubscriptionDTO
	): Promise<PluginSubscription> {
		return await this.commandBus.execute(new UpdatePluginSubscriptionCommand(id, updateDto));
	}

	@ApiOperation({ summary: 'Upgrade plugin subscription to a higher plan' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription upgraded successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin subscription ID', type: String, format: 'uuid' })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post(':id/upgrade')
	async upgrade(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: { planId: string }
	): Promise<PluginSubscription> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		return await this.commandBus.execute(
			new UpgradePluginSubscriptionCommand(id, body.planId, tenantId, organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Downgrade plugin subscription to a lower plan' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription downgraded successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin subscription ID', type: String, format: 'uuid' })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post(':id/downgrade')
	async downgrade(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: { planId: string }
	): Promise<PluginSubscription> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		return await this.commandBus.execute(
			new DowngradePluginSubscriptionCommand(id, body.planId, tenantId, organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Delete plugin subscription' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin subscription deleted successfully'
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@Param('id', ParseUUIDPipe) subscriberId: string,
		@Param('pluginTenantId', ParseUUIDPipe) pluginTenantId: string
	): Promise<void> {
		await this.commandBus.execute(new DeletePluginSubscriptionCommand(subscriberId, pluginTenantId));
	}
}
