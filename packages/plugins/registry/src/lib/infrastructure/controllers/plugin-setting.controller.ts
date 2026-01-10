import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
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
	BulkUpdatePluginSettingsCommand,
	CreatePluginSettingCommand,
	DeletePluginSettingCommand,
	GetPluginSettingByIdQuery,
	GetPluginSettingsByCategoryQuery,
	GetPluginSettingsByKeyQuery,
	GetPluginSettingsByPluginIdQuery,
	UpdatePluginSettingCommand
} from '../../application';
import { PluginSetting, PluginSettingService } from '../../domain';
import {
	BulkUpdatePluginSettingsDTO,
	CreatePluginSettingDTO,
	IPluginSetting,
	PluginSettingQueryDTO
} from '../../shared';

@ApiTags('Plugin Settings')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/:pluginId/settings')
export class PluginSettingController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly pluginSettingService: PluginSettingService
	) {}

	@ApiOperation({ summary: 'Create plugin setting' })
	@ApiParam({
		name: 'pluginId',
		description: 'Plugin ID',
		type: String,
		format: 'uuid'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin setting created successfully',
		type: PluginSetting
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	async create(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() createDto: CreatePluginSettingDTO
	): Promise<IPluginSetting> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();
		return await this.commandBus.execute(
			new CreatePluginSettingCommand({ ...createDto, pluginId }, tenantId, organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Get all plugin settings' })
	@ApiParam({
		name: 'pluginId',
		description: 'Plugin ID',
		type: String,
		format: 'uuid'
	})
	@ApiQuery({
		name: 'category',
		required: false,
		description: 'Filter by setting category'
	})
	@ApiQuery({
		name: 'key',
		required: false,
		description: 'Filter by setting key'
	})
	@ApiQuery({
		name: 'pluginTenantId',
		required: false,
		description: 'Filter by plugin tenant ID'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings retrieved successfully',
		type: [PluginSetting]
	})
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get()
	async findAll(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Query() query: PluginSettingQueryDTO
	): Promise<IPluginSetting[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Handle category filter
		if (query.category) {
			return await this.queryBus.execute(
				new GetPluginSettingsByCategoryQuery(
					pluginId,
					query.category,
					query.pluginTenantId,
					['plugin', 'pluginTenant'],
					tenantId,
					organizationId
				)
			);
		}

		// Handle key filter
		if (query.key) {
			const setting = await this.queryBus.execute(
				new GetPluginSettingsByKeyQuery(
					pluginId,
					query.key,
					query.pluginTenantId,
					['plugin', 'pluginTenant'],
					tenantId,
					organizationId
				)
			);
			return setting ? [setting] : [];
		}

		// Default: get all settings
		return await this.queryBus.execute(
			new GetPluginSettingsByPluginIdQuery(pluginId, ['plugin', 'pluginTenant'], tenantId, organizationId)
		);
	}

	@ApiOperation({ summary: 'Get plugin setting by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin setting retrieved successfully',
		type: PluginSetting
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin setting ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get(':id')
	async findOne(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('id', ParseUUIDPipe) id: string
	): Promise<IPluginSetting> {
		const tenantId = RequestContext.currentTenantId();
		return await this.queryBus.execute(
			new GetPluginSettingByIdQuery(id, ['plugin', 'pluginTenant'], tenantId, null)
		);
	}

	@ApiOperation({ summary: 'Bulk update plugin settings' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings updated successfully',
		type: [PluginSetting]
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Patch()
	async bulkUpdateSettings(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() bulkUpdateDto: BulkUpdatePluginSettingsDTO
	): Promise<PluginSetting[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		return await this.commandBus.execute(
			new BulkUpdatePluginSettingsCommand(bulkUpdateDto, tenantId, organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Update plugin setting and validate' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Setting updated and validation result',
		schema: {
			type: 'object',
			properties: {
				setting: { $ref: '#/components/schemas/PluginSetting' },
				validation: {
					type: 'object',
					properties: {
						valid: { type: 'boolean' },
						errors: { type: 'array', items: { type: 'string' } }
					}
				}
			}
		}
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin setting ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id')
	async updateAndValidate(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateData: { value: any; [key: string]: any }
	): Promise<{ setting: IPluginSetting; validation: { valid: boolean; errors?: string[] } }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		// Get current setting for validation
		const setting = await this.queryBus.execute(
			new GetPluginSettingByIdQuery(id, ['plugin', 'pluginTenant'], tenantId, organizationId)
		);

		const isValid = await this.pluginSettingService.validateSetting(setting, updateData.value);

		// Update the setting if validation passes
		if (isValid) {
			const updatedSetting = await this.commandBus.execute(
				new UpdatePluginSettingCommand(id, updateData, tenantId, organizationId, userId)
			);
			return {
				setting: updatedSetting as IPluginSetting,
				validation: { valid: true }
			};
		} else {
			return {
				setting,
				validation: {
					valid: false,
					errors: ['Validation failed']
				}
			};
		}
	}

	@ApiOperation({ summary: 'Delete plugin setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin setting deleted successfully'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin setting ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Delete(':id')
	async delete(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('id', ParseUUIDPipe) id: string
	): Promise<{ deleted: boolean; id: string }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		await this.commandBus.execute(new DeletePluginSettingCommand(id, tenantId, organizationId, userId));
		return { deleted: true, id };
	}
}
