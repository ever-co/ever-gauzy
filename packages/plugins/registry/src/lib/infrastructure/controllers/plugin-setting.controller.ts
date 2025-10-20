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
	ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { TenantPermissionGuard, PermissionGuard, Permissions, RequestContext } from '@gauzy/core';
import { PermissionsEnum, IPagination } from '@gauzy/contracts';
import {
	CreatePluginSettingDTO,
	UpdatePluginSettingDTO,
	PluginSettingQueryDTO,
	BulkUpdatePluginSettingsDTO,
	SetPluginSettingValueDTO
} from '../../shared/dto/plugin-setting.dto';
import { PluginSetting } from '../../domain/entities/plugin-setting.entity';
import { PluginSettingService } from '../../domain/services/plugin-setting.service';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';

// Commands
import {
	CreatePluginSettingCommand,
	UpdatePluginSettingCommand,
	DeletePluginSettingCommand,
	SetPluginSettingValueCommand,
	BulkUpdatePluginSettingsCommand
} from '../../domain/commands';

// Queries
import {
	GetPluginSettingsQuery,
	GetPluginSettingByIdQuery,
	GetPluginSettingsByPluginIdQuery
} from '../../domain/queries';

@ApiTags('Plugin Settings')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugin-settings')
export class PluginSettingController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly pluginSettingService: PluginSettingService
	) {}

	@ApiOperation({ summary: 'Create plugin setting' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin setting created successfully',
		type: PluginSetting
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	async create(@Body() createDto: CreatePluginSettingDTO): Promise<IPluginSetting> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		// Note: organizationId should come from the DTO or be retrieved from user context
		return await this.commandBus.execute(
			new CreatePluginSettingCommand(createDto, tenantId, createDto.organizationId, userId)
		);
	}

	@ApiOperation({ summary: 'Get all plugin settings' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings retrieved successfully',
		type: [PluginSetting]
	})
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get()
	async findAll(@Query() query: PluginSettingQueryDTO): Promise<IPagination<IPluginSetting>> {
		const tenantId = RequestContext.currentTenantId();
		// Convert query to proper where conditions
		const where: any = { ...query };
		if (query.category) {
			where.categoryId = query.category;
			delete where.category;
		}
		return await this.queryBus.execute(
			new GetPluginSettingsQuery(
				{ where, relations: ['plugin', 'pluginTenant'] },
				tenantId,
				null // organizationId - should be passed in query or derived from context
			)
		);
	}

	@ApiOperation({ summary: 'Get plugin setting by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin setting retrieved successfully',
		type: PluginSetting
	})
	@ApiParam({ name: 'id', description: 'Plugin setting ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get(':id')
	async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<IPluginSetting> {
		const tenantId = RequestContext.currentTenantId();
		return await this.queryBus.execute(
			new GetPluginSettingByIdQuery(id, ['plugin', 'pluginTenant'], tenantId, null)
		);
	}

	@ApiOperation({ summary: 'Get plugin settings by plugin ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings retrieved successfully',
		type: [PluginSetting]
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('plugin/:pluginId')
	async findByPluginId(@Param('pluginId', ParseUUIDPipe) pluginId: string): Promise<IPluginSetting[]> {
		const tenantId = RequestContext.currentTenantId();
		return await this.queryBus.execute(
			new GetPluginSettingsByPluginIdQuery(pluginId, ['plugin', 'pluginTenant'], tenantId, null)
		);
	}

	@ApiOperation({ summary: 'Get plugin settings by plugin tenant ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings retrieved successfully',
		type: [PluginSetting]
	})
	@ApiParam({ name: 'pluginTenantId', description: 'Plugin Tenant ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('plugin-tenant/:pluginTenantId')
	async findByPluginTenantId(
		@Param('pluginTenantId', ParseUUIDPipe) pluginTenantId: string
	): Promise<PluginSetting[]> {
		return await this.pluginSettingService.findByPluginTenantId(pluginTenantId, ['plugin', 'pluginTenant']);
	}

	@ApiOperation({ summary: 'Get plugin settings by category' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings retrieved successfully',
		type: [PluginSetting]
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID' })
	@ApiParam({ name: 'category', description: 'Setting category' })
	@ApiQuery({ name: 'pluginTenantId', required: false, description: 'Plugin Tenant ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('plugin/:pluginId/category/:categoryId')
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
	@ApiParam({ name: 'pluginId', description: 'Plugin ID' })
	@ApiParam({ name: 'key', description: 'Setting key' })
	@ApiQuery({ name: 'pluginTenantId', required: false, description: 'Plugin Tenant ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get('plugin/:pluginId/key/:key/value')
	async getSettingValue(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Param('key') key: string,
		@Query('pluginTenantId') pluginTenantId?: string
	): Promise<any> {
		return await this.pluginSettingService.getSettingValue(pluginId, key, pluginTenantId);
	}

	@ApiOperation({ summary: 'Set plugin setting value' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin setting value updated successfully',
		type: PluginSetting
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put('value')
	async setSettingValue(@Body() setValueDto: SetPluginSettingValueDTO): Promise<PluginSetting> {
		return this.pluginSettingService.setSettingValue(
			setValueDto.pluginId,
			setValueDto.key,
			setValueDto.value,
			setValueDto.pluginTenantId
		);
	}

	@ApiOperation({ summary: 'Bulk update plugin settings' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin settings updated successfully',
		type: [PluginSetting]
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put('bulk')
	async bulkUpdateSettings(@Body() bulkUpdateDto: BulkUpdatePluginSettingsDTO): Promise<PluginSetting[]> {
		const settingsWithTenantId = bulkUpdateDto.settings.map((setting) => ({
			...setting,
			pluginTenantId: bulkUpdateDto.pluginTenantId
		}));

		return this.pluginSettingService.bulkUpdateSettings(bulkUpdateDto.pluginId, settingsWithTenantId);
	}

	@ApiOperation({ summary: 'Update plugin setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin setting updated successfully',
		type: PluginSetting
	})
	@ApiParam({ name: 'id', description: 'Plugin setting ID' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id')
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() updateDto: UpdatePluginSettingDTO
	): Promise<IPluginSetting> {
		await this.pluginSettingService.update(id, updateDto);
		return await this.pluginSettingService.findOneByIdString(id);
	}

	@ApiOperation({ summary: 'Delete plugin setting' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin setting deleted successfully'
	})
	@ApiParam({ name: 'id', description: 'Plugin setting ID' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		await this.pluginSettingService.delete(id);
	}

	@ApiOperation({ summary: 'Validate plugin setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Setting validation result'
	})
	@ApiParam({ name: 'id', description: 'Plugin setting ID' })
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Post(':id/validate')
	async validateSetting(
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
