import { Public } from '@gauzy/common';
import { PermissionsEnum } from '@gauzy/contracts';
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
	BulkCreatePluginPlansCommand,
	BulkPluginPlanOperationCommand,
	CopyPluginPlanCommand,
	CreatePluginSubscriptionPlanCommand,
	DeletePluginSubscriptionPlanCommand,
	GetActivePluginPlansQuery,
	GetPluginPlanAnalyticsQuery,
	GetPluginSubscriptionPlanByIdQuery,
	GetPluginSubscriptionPlansByPluginIdQuery,
	ListPluginSubscriptionPlansQuery,
	UpdatePluginSubscriptionPlanCommand
} from '../../application';
import { PluginSubscriptionPlan } from '../../domain';
import {
	BulkPluginPlanOperationDTO,
	CopyPluginPlanDTO,
	CreateMultiplePluginPlansDTO,
	CreatePluginSubscriptionPlanDTO,
	PluginPlanAnalyticsDTO,
	PluginSubscriptionPlanQueryDTO,
	UpdatePluginSubscriptionPlanDTO
} from '../../shared';

@ApiTags('Plugin Subscription Plans')
@Controller('plugin-plans')
export class PluginSubscriptionPlanController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({ summary: 'Create plugin subscription plan' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin subscription plan created successfully',
		type: PluginSubscriptionPlan
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	async create(@Body() createDto: CreatePluginSubscriptionPlanDTO): Promise<PluginSubscriptionPlan> {
		const userId = RequestContext.currentUserId();
		return await this.commandBus.execute(new CreatePluginSubscriptionPlanCommand(createDto, userId));
	}

	@ApiOperation({ summary: 'Create multiple plugin subscription plans' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin subscription plans created successfully',
		type: [PluginSubscriptionPlan]
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post('bulk-create')
	async createMultiple(@Body() createDto: CreateMultiplePluginPlansDTO): Promise<PluginSubscriptionPlan[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();
		return await this.commandBus.execute(
			new BulkCreatePluginPlansCommand(createDto.plans, tenantId, organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Get all plugin subscription plans' })
	@ApiQuery({ name: 'pluginId', required: false, description: 'Filter by plugin ID' })
	@ApiQuery({ name: 'type', required: false, description: 'Filter by plan type' })
	@ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status', type: Boolean })
	@ApiQuery({ name: 'isPopular', required: false, description: 'Filter by popular status', type: Boolean })
	@ApiQuery({ name: 'isRecommended', required: false, description: 'Filter by recommended status', type: Boolean })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription plans retrieved successfully',
		type: [PluginSubscriptionPlan]
	})
	@Public()
	@Get()
	async findAll(@Query() query: PluginSubscriptionPlanQueryDTO): Promise<PluginSubscriptionPlan[]> {
		return await this.queryBus.execute(new ListPluginSubscriptionPlansQuery(query));
	}

	@ApiOperation({ summary: 'Get active plugin subscription plans' })
	@ApiQuery({ name: 'pluginId', required: false, description: 'Filter by plugin ID' })
	@ApiQuery({ name: 'type', required: false, description: 'Filter by plan type' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Active plugin subscription plans retrieved successfully',
		type: [PluginSubscriptionPlan]
	})
	@Public()
	@Get('active')
	async getActivePlans(
		@Query('pluginId') pluginId?: string,
		@Query('type') type?: string
	): Promise<PluginSubscriptionPlan[]> {
		return await this.queryBus.execute(new GetActivePluginPlansQuery(pluginId, type as any));
	}

	@ApiOperation({ summary: 'Get plugin subscription plans by plugin ID' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription plans retrieved successfully',
		type: [PluginSubscriptionPlan]
	})
	@Public()
	@Get('plugin/:pluginId')
	async getByPluginId(@Param('pluginId', ParseUUIDPipe) pluginId: string): Promise<PluginSubscriptionPlan[]> {
		return await this.queryBus.execute(new GetPluginSubscriptionPlansByPluginIdQuery(pluginId));
	}

	@ApiOperation({ summary: 'Get plugin subscription plan by ID' })
	@ApiParam({ name: 'id', description: 'Plugin subscription plan ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription plan retrieved successfully',
		type: PluginSubscriptionPlan
	})
	@Public()
	@Get(':id')
	async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PluginSubscriptionPlan> {
		return await this.queryBus.execute(new GetPluginSubscriptionPlanByIdQuery(id, ['plugin']));
	}

	@ApiOperation({ summary: 'Update plugin subscription plan' })
	@ApiParam({ name: 'id', description: 'Plugin subscription plan ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription plan updated successfully',
		type: PluginSubscriptionPlan
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id')
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateDto: UpdatePluginSubscriptionPlanDTO
	): Promise<PluginSubscriptionPlan> {
		return await this.commandBus.execute(new UpdatePluginSubscriptionPlanCommand(id, updateDto));
	}

	@ApiOperation({ summary: 'Partially update plugin subscription plan' })
	@ApiParam({ name: 'id', description: 'Plugin subscription plan ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription plan updated successfully',
		type: PluginSubscriptionPlan
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Patch(':id')
	async partialUpdate(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateDto: Partial<UpdatePluginSubscriptionPlanDTO>
	): Promise<PluginSubscriptionPlan> {
		return await this.commandBus.execute(
			new UpdatePluginSubscriptionPlanCommand(id, updateDto as UpdatePluginSubscriptionPlanDTO)
		);
	}

	@ApiOperation({ summary: 'Delete plugin subscription plan' })
	@ApiParam({ name: 'id', description: 'Plugin subscription plan ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin subscription plan deleted successfully'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		await this.commandBus.execute(new DeletePluginSubscriptionPlanCommand(id));
	}

	@ApiOperation({ summary: 'Copy plugin subscription plan' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin subscription plan copied successfully',
		type: PluginSubscriptionPlan
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post('copy')
	async copy(@Body() copyDto: CopyPluginPlanDTO): Promise<PluginSubscriptionPlan> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const user = RequestContext.currentUser();

		return await this.commandBus.execute(new CopyPluginPlanCommand(copyDto, tenantId, organizationId, user?.id));
	}

	@ApiOperation({ summary: 'Bulk operations on plugin subscription plans' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Bulk operation completed successfully'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post('bulk')
	@HttpCode(HttpStatus.OK)
	async bulkOperation(@Body() operationDto: BulkPluginPlanOperationDTO): Promise<void> {
		await this.commandBus.execute(new BulkPluginPlanOperationCommand(operationDto));
	}

	@ApiOperation({ summary: 'Get plugin subscription plan analytics' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin subscription plan analytics retrieved successfully'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Post('analytics')
	async getAnalytics(@Body() analyticsDto: PluginPlanAnalyticsDTO): Promise<{
		totalSubscriptions: number;
		activeSubscriptions: number;
		revenue: number;
		conversionRate: number;
	}> {
		return await this.queryBus.execute(new GetPluginPlanAnalyticsQuery(analyticsDto));
	}
}
