import { IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetPluginTenantUsersResult, ManagePluginTenantUsersResult } from '../../application/plugin-tenant';
import {
	ApprovePluginTenantCommand,
	BulkUpdatePluginTenantCommand,
	CreatePluginTenantCommand,
	DeletePluginTenantCommand,
	DisablePluginTenantCommand,
	EnablePluginTenantCommand,
	ManagePluginTenantUsersCommand,
	UpdatePluginTenantCommand,
	UpdatePluginTenantConfigurationCommand
} from '../../application/plugin-tenant/commands';
import {
	CheckPluginTenantAccessQuery,
	GetAllPluginTenantsQuery,
	GetPluginTenantByIdQuery,
	GetPluginTenantQuotaInfoQuery,
	GetPluginTenantsByPluginQuery,
	GetPluginTenantsByTenantQuery,
	GetPluginTenantStatisticsQuery,
	GetPluginTenantUsersQuery,
	PluginTenantUserType
} from '../../application/plugin-tenant/queries';
import {
	IPluginTenant,
	IPluginTenantAccessCheckResult,
	IPluginTenantQuotaInfo,
	IPluginTenantStatistics
} from '../../shared';
import {
	CreatePluginTenantDTO,
	ManagePluginTenantUsersDTO,
	PluginTenantApprovalDTO,
	PluginTenantBulkOperationDTO,
	PluginTenantConfigurationDTO,
	PluginTenantQueryDTO,
	UpdatePluginTenantDTO
} from '../../shared/dto';

@ApiTags('Plugin Tenant Management')
@Controller('/plugin-tenants')
@UseGuards(TenantPermissionGuard)
export class PluginTenantController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Create a new plugin tenant relationship
	 */
	@ApiOperation({
		summary: 'Create Plugin Tenant',
		description: 'Creates a new plugin tenant relationship with specified configuration and access controls'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin tenant created successfully',
		type: Object
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input data'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'Plugin tenant already exists'
	})
	@Post()
	async create(@Body() createDto: CreatePluginTenantDTO): Promise<IPluginTenant> {
		return this.commandBus.execute(new CreatePluginTenantCommand(createDto));
	}

	/**
	 * Get all plugin tenants with optional filtering
	 */
	@ApiOperation({
		summary: 'Get All Plugin Tenants',
		description: 'Retrieves all plugin tenant relationships with optional filtering by various criteria'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenants retrieved successfully',
		type: [Object]
	})
	@Get()
	async findAll(@Query() query: PluginTenantQueryDTO): Promise<IPluginTenant[]> {
		return this.queryBus.execute(new GetAllPluginTenantsQuery(query));
	}

	/**
	 * Get plugin tenant statistics
	 */
	@ApiOperation({
		summary: 'Get Plugin Tenant Statistics',
		description: 'Retrieves comprehensive statistics about plugin tenant usage and quotas'
	})
	@ApiQuery({ name: 'tenantId', required: false, type: String })
	@ApiQuery({ name: 'organizationId', required: false, type: String })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Statistics retrieved successfully',
		type: Object
	})
	@Get('/statistics')
	async getStatistics(
		@Query('tenantId') tenantId?: string,
		@Query('organizationId') organizationId?: string
	): Promise<IPluginTenantStatistics> {
		return this.queryBus.execute(new GetPluginTenantStatisticsQuery(tenantId, organizationId));
	}

	/**
	 * Get plugin tenants by plugin ID
	 */
	@ApiOperation({
		summary: 'Get Plugin Tenants by Plugin',
		description: 'Retrieves all tenant relationships for a specific plugin'
	})
	@ApiParam({ name: 'pluginId', type: 'string', description: 'Plugin ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenants retrieved successfully',
		type: [Object]
	})
	@Get('/by-plugin/:pluginId')
	async findByPlugin(
		@Param('pluginId') pluginId: string,
		@Query('skip') skip?: number,
		@Query('take') take?: number
	): Promise<IPluginTenant[]> {
		return this.queryBus.execute(new GetPluginTenantsByPluginQuery(pluginId, skip, take));
	}

	/**
	 * Get plugin tenants by tenant ID
	 */
	@ApiOperation({
		summary: 'Get Plugin Tenants by Tenant',
		description: 'Retrieves all plugin relationships for a specific tenant/organization'
	})
	@ApiParam({ name: 'tenantId', type: 'string', description: 'Tenant ID' })
	@ApiQuery({ name: 'organizationId', required: false, type: String })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenants retrieved successfully',
		type: [Object]
	})
	@Get('/by-tenant/:tenantId')
	async findByTenant(
		@Param('tenantId') tenantId: string,
		@Query('organizationId') organizationId?: string,
		@Query('skip') skip?: number,
		@Query('take') take?: number
	): Promise<IPagination<IPluginTenant>> {
		return this.queryBus.execute(new GetPluginTenantsByTenantQuery(tenantId, organizationId, skip, take));
	}

	/**
	 * Check user access to a plugin
	 */
	@ApiOperation({
		summary: 'Check Plugin Access',
		description: 'Checks if a user has access to a specific plugin based on tenant configuration'
	})
	@ApiQuery({ name: 'userId', type: String })
	@ApiQuery({ name: 'pluginId', type: String })
	@ApiQuery({ name: 'tenantId', required: false, type: String })
	@ApiQuery({ name: 'organizationId', required: false, type: String })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Access check completed',
		type: Object
	})
	@Get('/check-access')
	async checkAccess(
		@Query('userId') userId: string,
		@Query('pluginId') pluginId: string,
		@Query('tenantId') tenantId?: string,
		@Query('organizationId') organizationId?: string,
		@Query('userRoles') userRoles: any[] = []
	): Promise<IPluginTenantAccessCheckResult> {
		return this.queryBus.execute(
			new CheckPluginTenantAccessQuery(userId, pluginId, userRoles, tenantId, organizationId)
		);
	}

	/**
	 * Get plugin tenant by ID
	 */
	@ApiOperation({
		summary: 'Get Plugin Tenant by ID',
		description: 'Retrieves a specific plugin tenant by its ID with full relation data'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenant retrieved successfully',
		type: Object
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin tenant not found'
	})
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<IPluginTenant> {
		return this.queryBus.execute(new GetPluginTenantByIdQuery(id));
	}

	/**
	 * Get quota information for a plugin tenant
	 */
	@ApiOperation({
		summary: 'Get Plugin Tenant Quota Info',
		description: 'Retrieves quota and usage information for a specific plugin tenant'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Quota information retrieved successfully',
		type: Object
	})
	@Get(':id/quota')
	async getQuotaInfo(@Param('id') id: string): Promise<IPluginTenantQuotaInfo> {
		return this.queryBus.execute(new GetPluginTenantQuotaInfoQuery(id));
	}

	/**
	 * Get users for a plugin tenant (allowed, denied, or all)
	 */
	@ApiOperation({
		summary: 'Get Plugin Tenant Users',
		description: 'Retrieves users assigned to a plugin tenant with their access type (allowed/denied)'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiQuery({
		name: 'type',
		required: false,
		enum: ['allowed', 'denied', 'all'],
		description: 'Type of users to retrieve'
	})
	@ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
	@ApiQuery({ name: 'take', required: false, type: Number, description: 'Number of records to take' })
	@ApiQuery({ name: 'searchTerm', required: false, type: String, description: 'Search term for filtering users' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Users retrieved successfully',
		type: Object
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin tenant not found'
	})
	@Get(':id/users')
	async getPluginTenantUsers(
		@Param('id') id: string,
		@Query('type') type: PluginTenantUserType = 'all',
		@Query('skip') skip?: number,
		@Query('take') take?: number,
		@Query('searchTerm') searchTerm?: string
	): Promise<GetPluginTenantUsersResult> {
		return this.queryBus.execute(new GetPluginTenantUsersQuery(id, type, skip, take, searchTerm));
	}

	/**
	 * Manage users for a plugin tenant (allow, deny, remove)
	 */
	@ApiOperation({
		summary: 'Manage Plugin Tenant Users',
		description: 'Add or remove users from allowed/denied lists for a plugin tenant'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'User management operation completed successfully',
		type: Object
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input data'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin tenant or users not found'
	})
	@Post(':id/users')
	async managePluginTenantUsers(
		@Param('id') id: string,
		@Body() dto: ManagePluginTenantUsersDTO
	): Promise<ManagePluginTenantUsersResult> {
		return this.commandBus.execute(new ManagePluginTenantUsersCommand(id, dto.userIds, dto.operation, dto.reason));
	}

	/**
	 * Update plugin tenant
	 */
	@ApiOperation({
		summary: 'Update Plugin Tenant',
		description: 'Updates an existing plugin tenant configuration'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenant updated successfully',
		type: Object
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin tenant not found'
	})
	@Put(':id')
	async update(@Param('id') id: string, @Body() updateDto: UpdatePluginTenantDTO): Promise<IPluginTenant> {
		return this.commandBus.execute(new UpdatePluginTenantCommand(id, updateDto));
	}

	/**
	 * Update plugin tenant configuration
	 */
	@ApiOperation({
		summary: 'Update Plugin Tenant Configuration',
		description: 'Updates the configuration and preferences for a plugin tenant'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Configuration updated successfully',
		type: Object
	})
	@Patch('/configuration')
	async updateConfiguration(@Body() configDto: PluginTenantConfigurationDTO): Promise<IPluginTenant> {
		return this.commandBus.execute(new UpdatePluginTenantConfigurationCommand(configDto));
	}

	/**
	 * Enable plugin tenant
	 */
	@ApiOperation({
		summary: 'Enable Plugin Tenant',
		description: 'Enables a plugin tenant, making it available for use'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenant enabled successfully',
		type: Object
	})
	@Patch(':id/enable')
	async enable(@Param('id') id: string): Promise<IPluginTenant> {
		return this.commandBus.execute(new EnablePluginTenantCommand(id));
	}

	/**
	 * Disable plugin tenant
	 */
	@ApiOperation({
		summary: 'Disable Plugin Tenant',
		description: 'Disables a plugin tenant, making it unavailable for use'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenant disabled successfully',
		type: Object
	})
	@Patch(':id/disable')
	async disable(@Param('id') id: string): Promise<IPluginTenant> {
		return this.commandBus.execute(new DisablePluginTenantCommand(id));
	}

	/**
	 * Approve or reject plugin tenant
	 */
	@ApiOperation({
		summary: 'Approve/Reject Plugin Tenant',
		description: 'Approves or rejects a plugin tenant installation request'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin tenant approval status updated successfully',
		type: Object
	})
	@Patch('/approval')
	async updateApproval(@Body() approvalDto: PluginTenantApprovalDTO): Promise<IPluginTenant> {
		return this.commandBus.execute(new ApprovePluginTenantCommand(approvalDto));
	}

	/**
	 * Bulk update plugin tenants
	 */
	@ApiOperation({
		summary: 'Bulk Update Plugin Tenants',
		description: 'Performs bulk operations on multiple plugin tenants (enable, disable, approve, etc.)'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Bulk operation completed',
		type: Object
	})
	@Patch('/bulk')
	async bulkUpdate(@Body() bulkDto: PluginTenantBulkOperationDTO): Promise<{
		success: IPluginTenant[];
		failed: Array<{ id: string; error: string }>;
	}> {
		return this.commandBus.execute(new BulkUpdatePluginTenantCommand(bulkDto));
	}

	/**
	 * Delete plugin tenant
	 */
	@ApiOperation({
		summary: 'Delete Plugin Tenant',
		description: 'Permanently deletes a plugin tenant relationship'
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Plugin Tenant ID' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin tenant deleted successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin tenant not found'
	})
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':id')
	async remove(@Param('id') id: string): Promise<void> {
		return this.commandBus.execute(new DeletePluginTenantCommand(id));
	}
}
