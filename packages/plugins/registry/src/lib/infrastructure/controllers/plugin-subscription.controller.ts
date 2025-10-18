import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	UseGuards,
	ParseUUIDPipe,
	Request
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TenantPermissionGuard, PermissionGuard, Permissions, RequestContext } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	CreatePluginSubscriptionDTO,
	UpdatePluginSubscriptionDTO,
	PluginSubscriptionQueryDTO,
	PurchasePluginSubscriptionDTO,
	CancelPluginSubscriptionDTO,
	RenewPluginSubscriptionDTO,
	PluginAccessCheckDTO
} from '../../shared/dto/plugin-subscription.dto';
import { PluginSubscription } from '../../domain/entities/plugin-subscription.entity';

// CQRS Commands
import {
	PurchasePluginSubscriptionCommand,
	CreatePluginSubscriptionCommand,
	UpdatePluginSubscriptionCommand,
	DeletePluginSubscriptionCommand,
	CancelPluginSubscriptionCommand,
	RenewPluginSubscriptionCommand,
	ProcessBillingCommand
} from '../../domain/commands';

// CQRS Queries
import {
	GetPluginSubscriptionsQuery,
	GetPluginSubscriptionByIdQuery,
	GetPluginSubscriptionsByPluginIdQuery,
	GetPluginSubscriptionsBySubscriberIdQuery,
	GetActivePluginSubscriptionQuery,
	CheckPluginAccessQuery,
	GetExpiringSubscriptionsQuery
} from '../../domain/queries';

@ApiTags('Plugin Subscriptions')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugin-subscriptions')
export class PluginSubscriptionController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	@ApiOperation({ summary: 'Purchase plugin subscription' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin subscription purchased successfully',
		type: PluginSubscription
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post('purchase')
	async purchaseSubscription(@Body() purchaseDto: PurchasePluginSubscriptionDTO): Promise<PluginSubscription> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const user = RequestContext.currentUser();

		return await this.commandBus.execute(
			new PurchasePluginSubscriptionCommand(
				purchaseDto,
				tenantId,
				organizationId,
				user?.id
			)
		);
	}

	@ApiOperation({ summary: 'Create plugin subscription (admin only)' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin subscription created successfully',
		type: PluginSubscription
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	async create(@Body() createDto: CreatePluginSubscriptionDTO): Promise<PluginSubscription> {
		return await this.commandBus.execute(new CreatePluginSubscriptionCommand(createDto));
	}

	@ApiOperation({ summary: 'Get all plugin subscriptions' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscriptions retrieved successfully',
		type: [PluginSubscription]
	})
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get()
	async findAll(@Query() query: PluginSubscriptionQueryDTO): Promise<PluginSubscription[]> {
		return await this.queryBus.execute(new GetPluginSubscriptionsQuery(query));
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

	@ApiOperation({ summary: 'Get plugin subscriptions by plugin ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscriptions retrieved successfully',
		type: [PluginSubscription]
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('plugin/:pluginId')
	async findByPluginId(@Param('pluginId', ParseUUIDPipe) pluginId: string): Promise<PluginSubscription[]> {
		return await this.queryBus.execute(
			new GetPluginSubscriptionsByPluginIdQuery(pluginId, ['plugin', 'pluginTenant', 'subscriber'])
		);
	}

	@ApiOperation({ summary: 'Get plugin subscriptions by subscriber ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscriptions retrieved successfully',
		type: [PluginSubscription]
	})
	@ApiParam({ name: 'subscriberId', description: 'Subscriber ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('subscriber/:subscriberId')
	async findBySubscriberId(
		@Param('subscriberId', ParseUUIDPipe) subscriberId: string
	): Promise<PluginSubscription[]> {
		return await this.queryBus.execute(
			new GetPluginSubscriptionsBySubscriberIdQuery(subscriberId, [
				'plugin',
				'pluginTenant',
				'subscriber'
			])
		);
	}

	@ApiOperation({ summary: 'Get active subscription for plugin' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Active subscription retrieved successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID' })
	@ApiQuery({ name: 'subscriberId', required: false, description: 'Subscriber ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('plugin/:pluginId/active')
	async findActiveSubscription(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Query('subscriberId') subscriberId?: string
	): Promise<PluginSubscription | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.queryBus.execute(
			new GetActivePluginSubscriptionQuery(pluginId, tenantId, organizationId, subscriberId)
		);
	}

	@ApiOperation({ summary: 'Check plugin access' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin access check result'
	})
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Post('check-access')
	async checkPluginAccess(
		@Body() accessCheckDto: PluginAccessCheckDTO
	): Promise<{ hasAccess: boolean; subscription?: PluginSubscription }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.queryBus.execute(
			new CheckPluginAccessQuery(accessCheckDto, tenantId, organizationId)
		);
	}

	@ApiOperation({ summary: 'Get expiring subscriptions' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Expiring subscriptions retrieved successfully',
		type: [PluginSubscription]
	})
	@ApiQuery({ name: 'days', required: false, description: 'Days until expiry (default: 7)' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('expiring/list')
	async getExpiringSubscriptions(@Query('days') days?: number): Promise<PluginSubscription[]> {
		return await this.queryBus.execute(new GetExpiringSubscriptionsQuery(days || 7));
	}

	@ApiOperation({ summary: 'Cancel plugin subscription' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription cancelled successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id/cancel')
	async cancelSubscription(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() cancelDto: CancelPluginSubscriptionDTO
	): Promise<PluginSubscription> {
		return await this.commandBus.execute(new CancelPluginSubscriptionCommand(id, cancelDto.reason));
	}

	@ApiOperation({ summary: 'Renew plugin subscription' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription renewed successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id/renew')
	async renewSubscription(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() renewDto: RenewPluginSubscriptionDTO
	): Promise<PluginSubscription> {
		return await this.commandBus.execute(new RenewPluginSubscriptionCommand(id));
	}

	@ApiOperation({ summary: 'Process subscription billing' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Billing processed successfully'
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post(':id/billing/process')
	async processBilling(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean; message: string }> {
		return await this.commandBus.execute(new ProcessBillingCommand(id));
	}

	@ApiOperation({ summary: 'Update plugin subscription' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription updated successfully',
		type: PluginSubscription
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id')
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateDto: UpdatePluginSubscriptionDTO
	): Promise<PluginSubscription> {
		return await this.commandBus.execute(new UpdatePluginSubscriptionCommand(id, updateDto));
	}

	@ApiOperation({ summary: 'Delete plugin subscription' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin subscription deleted successfully'
	})
	@ApiParam({ name: 'id', description: 'Plugin subscription ID' })
	@Permissions(PermissionsEnum.PLUGIN_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		await this.commandBus.execute(new DeletePluginSubscriptionCommand(id));
	}
}
