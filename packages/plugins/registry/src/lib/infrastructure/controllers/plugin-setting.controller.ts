import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginSetting } from '../../domain/entities/plugin-setting.entity';
import { PluginSettingService } from '../../domain/services/plugin-setting.service';
import {
	BulkUpdatePluginSettingsDTO,
	CreatePluginSettingDTO,
	PluginSettingQueryDTO
} from '../../shared/dto/plugin-setting.dto';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';

// Commands
import { CreatePluginSettingCommand } from '../../application/commands';

// Queries
import { GetPluginSettingByIdQuery, GetPluginSettingsByPluginIdQuery } from '../../application/queries';

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
		const userId = RequestContext.currentUserId();
		return await this.commandBus.execute(
			new CreatePluginSettingCommand({ ...createDto, pluginId }, tenantId, createDto.organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Get all plugin settings' })
	@ApiParam({
		name: 'pluginId',
		description: 'Plugin ID',
		type: String,
		format: 'uuid'
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
		return await this.queryBus.execute(
			new GetPluginSettingsByPluginIdQuery(pluginId, ['plugin', 'pluginTenant'], tenantId, null)
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

	@ApiOperation({ summary: 'Get plugin settings by category' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings retrieved successfully',
		type: [PluginSetting]
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'categoryId', description: 'Setting category ID' })
	@ApiQuery({ name: 'pluginTenantId', required: false, description: 'Plugin Tenant ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('categories/:categoryId')
	async findByCategory(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('categoryId') categoryId: string,
		@Query('pluginTenantId') pluginTenantId?: string
	): Promise<PluginSetting[]> {
		return this.pluginSettingService.findByCategory(pluginId, categoryId, pluginTenantId, [
			'plugin',
			'pluginTenant'
		]);
	}

	@ApiOperation({ summary: 'Get plugin setting value by key' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin setting value retrieved successfully'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'key', description: 'Setting key' })
	@ApiQuery({ name: 'pluginTenantId', required: false, description: 'Plugin Tenant ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('keys/:key/value')
	async getSettingValue(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('key') key: string,
		@Query('pluginTenantId') pluginTenantId?: string
	): Promise<any> {
		return await this.pluginSettingService.getSettingValue(pluginId, key, pluginTenantId);
	}

	@ApiOperation({ summary: 'Bulk update plugin settings' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings updated successfully',
		type: [PluginSetting]
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Patch('bulk')
	async bulkUpdateSettings(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() bulkUpdateDto: BulkUpdatePluginSettingsDTO
	): Promise<PluginSetting[]> {
		const settingsWithTenantId = bulkUpdateDto.settings.map((setting) => ({
			...setting,
			pluginTenantId: bulkUpdateDto.pluginTenantId
		}));

		return this.pluginSettingService.bulkUpdateSettings(pluginId, settingsWithTenantId);
	}

	@ApiOperation({ summary: 'Validate plugin setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Setting validation result'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Plugin setting ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Post(':id/validate')
	async validateSetting(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('id', ParseUUIDPipe) id: string,
		@Body('value') value: any
	): Promise<{ valid: boolean; errors?: string[] }> {
		const setting = await this.pluginSettingService.findOneByIdString(id);
		const isValid = await this.pluginSettingService.validateSetting(setting, value);

		return {
			valid: isValid,
			errors: isValid ? undefined : ['Validation failed']
		};
	}
}
