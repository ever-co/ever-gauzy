import { ID } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { Controller, Get, HttpStatus, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginTagService } from '../../domain/services/plugin-tag.service';
import { IPluginTagStatistics } from '../../shared/models/plugin-tag.model';

/**
 * Plugin Analytics Controller
 * Provides analytics and statistics for various plugin-related data
 */
@ApiTags('Plugin Analytics')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/analytics')
export class PluginAnalyticsController {
	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Get plugin-tag analytics
	 *
	 * @param tenantId Optional tenant ID filter
	 * @param organizationId Optional organization ID filter
	 * @returns Plugin-tag analytics and statistics
	 */
	@Get('tags')
	@ApiOperation({
		summary: 'Get plugin-tag analytics',
		description:
			'Retrieve analytics and statistics about plugin-tag relationships including most popular tags and most tagged plugins.'
	})
	@ApiQuery({ name: 'tenantId', required: false, description: 'Filter analytics by tenant ID' })
	@ApiQuery({ name: 'organizationId', required: false, description: 'Filter analytics by organization ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin-tag analytics',
		schema: {
			type: 'object',
			properties: {
				totalRelationships: { type: 'number' },
				taggedPlugins: { type: 'number' },
				usedTags: { type: 'number' },
				popularTags: { type: 'array', items: { type: 'object' } },
				mostTaggedPlugins: { type: 'array', items: { type: 'object' } }
			}
		}
	})
	async getTagAnalytics(
		@Query('tenantId', new ParseUUIDPipe({ optional: true })) tenantId?: ID,
		@Query('organizationId', new ParseUUIDPipe({ optional: true })) organizationId?: ID
	): Promise<IPluginTagStatistics> {
		return this.pluginTagService.getStatistics(tenantId, organizationId);
	}
}
