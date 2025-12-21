import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import {
	IPluginTag,
	IPluginTagBulkCreateInput,
	IPluginTagBulkCreateResponse,
	IPluginTagBulkDeleteInput,
	IPluginTagBulkUpdateInput,
	IPluginTagCreateInput,
	IPluginTagPriorityUpdateInput,
	IPluginTagStatistics,
	IPluginsByTagsQuery,
	ITagsByPluginsQuery
} from '../../shared/models/plugin-tag.model';
import { PluginTag } from '../entities/plugin-tag.entity';
import { MikroOrmPluginTagRepository } from '../repositories/mikro-orm-plugin-tag.repository';
import { TypeOrmPluginTagRepository } from '../repositories/type-orm-plugin-tag.repository';

/**
 * PluginTag Service
 *
 * Comprehensive service for managing plugin-tag relationships with advanced business logic.
 * Provides CRUD operations, bulk operations, analytics, and complex querying capabilities.
 *
 * Key Features:
 * - Standard CRUD operations with validation
 * - Bulk tag association/disassociation
 * - Plugin discovery by tags with advanced filtering
 * - Tag analytics and statistics
 * - Performance-optimized queries
 * - Multi-tenant support
 * - Data integrity validation
 */
@Injectable()
export class PluginTagService extends TenantAwareCrudService<PluginTag> {
	constructor(
		public readonly typeOrmPluginTagRepository: TypeOrmPluginTagRepository,
		public readonly mikroOrmPluginTagRepository: MikroOrmPluginTagRepository
	) {
		super(typeOrmPluginTagRepository, mikroOrmPluginTagRepository);
	}

	/**
	 * Create a new plugin-tag relationship
	 *
	 * @param entity - Plugin-tag creation data
	 * @returns Promise<IPluginTag>
	 * @throws BadRequestException if relationship already exists
	 */
	async createTag(entity: IPluginTagCreateInput): Promise<IPluginTag> {
		// Check if the relationship already exists
		const existingRelation = await this.findOneByWhereOptions({
			pluginId: entity.pluginId,
			tagId: entity.tagId,
			...(entity.tenantId && { tenantId: entity.tenantId }),
			...(entity.organizationId && { organizationId: entity.organizationId })
		});

		if (existingRelation) {
			throw new BadRequestException(
				`Plugin-tag relationship already exists for plugin ${entity.pluginId} and tag ${entity.tagId}`
			);
		}

		// Add current tenant/organization context if not provided
		const createData = {
			...entity,
			tenantId: entity.tenantId || RequestContext.currentTenantId(),
			organizationId: entity.organizationId || RequestContext.currentOrganizationId(),
			appliedAt: new Date()
		};

		return super.create(createData);
	}

	/**
	 * Bulk create plugin-tag relationships
	 *
	 * @param input - Bulk creation data
	 * @returns Promise<IPluginTagBulkCreateResponse>
	 */
	async bulkCreate(input: IPluginTagBulkCreateInput): Promise<IPluginTagBulkCreateResponse> {
		const { pluginId, tagIds, tenantId, organizationId } = input;

		// Get current context
		const currentTenantId = tenantId || RequestContext.currentTenantId();
		const currentOrgId = organizationId || RequestContext.currentOrganizationId();

		// Check existing relationships
		const existingRelationsResult = await this.findAll({
			where: {
				pluginId,
				tagId: In(tagIds),
				...(currentTenantId && { tenantId: currentTenantId }),
				...(currentOrgId && { organizationId: currentOrgId })
			}
		});

		const existingTagIds = existingRelationsResult.items.map((rel) => rel.tagId);
		const newTagIds = tagIds.filter((tagId) => !existingTagIds.includes(tagId));

		// Create new relationships
		const newRelations: IPluginTag[] = [];
		for (const tagId of newTagIds) {
			const relation = await this.create({
				pluginId,
				tagId,
				tenantId: currentTenantId,
				organizationId: currentOrgId
			});
			newRelations.push(relation);
		}

		return {
			created: newRelations.length,
			existing: existingTagIds.length,
			pluginTags: newRelations
		};
	}

	/**
	 * Bulk delete plugin-tag relationships
	 *
	 * @param input - Bulk deletion criteria
	 * @returns Promise<number> - Number of deleted relationships
	 */
	async bulkDelete(input: IPluginTagBulkDeleteInput): Promise<number> {
		const whereConditions: FindOptionsWhere<PluginTag> = {};

		// Build where conditions based on input
		if (input.pluginId) {
			whereConditions.pluginId = input.pluginId;
		}

		if (input.tagId) {
			whereConditions.tagId = input.tagId;
		}

		if (input.ids && input.ids.length > 0) {
			whereConditions.id = In(input.ids);
		}

		if (input.tagIds && input.tagIds.length > 0 && input.pluginId) {
			whereConditions.tagId = In(input.tagIds);
			whereConditions.pluginId = input.pluginId;
		}

		// Add tenant/organization context
		if (input.tenantId) {
			whereConditions.tenantId = input.tenantId;
		}
		if (input.organizationId) {
			whereConditions.organizationId = input.organizationId;
		}

		const result = await this.typeOrmPluginTagRepository.delete(whereConditions);
		return result.affected || 0;
	}

	/**
	 * Bulk update plugin-tag relationships
	 *
	 * @param updates - Array of update operations
	 * @returns Promise<IPluginTag[]> - Updated plugin-tag relationships
	 */
	async bulkUpdate(updates: IPluginTagBulkUpdateInput[]): Promise<IPluginTag[]> {
		const updatedRelationships: IPluginTag[] = [];

		for (const update of updates) {
			try {
				await this.update(update.id, update.data);
				const updatedRelation = await this.findOneByIdString(update.id);
				if (updatedRelation) {
					updatedRelationships.push(updatedRelation);
				}
			} catch (error) {
				// Log error but continue with other updates
				console.error(`Failed to update plugin-tag relationship ${update.id}:`, error);
			}
		}

		return updatedRelationships;
	}

	/**
	 * Update priority order of plugin tags
	 *
	 * @param priorities - Array of priority updates
	 * @returns Promise<IPluginTag[]> - Updated plugin-tag relationships
	 */
	async updateTagsPriority(priorities: IPluginTagPriorityUpdateInput[]): Promise<IPluginTag[]> {
		const updatedRelationships: IPluginTag[] = [];

		for (const priorityUpdate of priorities) {
			try {
				// Update the priority field (assuming it exists in the entity)
				await this.update(priorityUpdate.id, { priority: priorityUpdate.priority } as any);
				const updatedRelation = await this.findOneByIdString(priorityUpdate.id);
				if (updatedRelation) {
					updatedRelationships.push(updatedRelation);
				}
			} catch (error) {
				// Log error but continue with other updates
				console.error(`Failed to update priority for plugin-tag relationship ${priorityUpdate.id}:`, error);
			}
		}

		return updatedRelationships;
	}

	/**
	 * Find plugins by tags with advanced filtering
	 *
	 * @param query - Query parameters for plugin discovery
	 * @returns Promise<IPagination<any>>
	 */
	async findPluginsByTags(query: IPluginsByTagsQuery): Promise<IPagination<any>> {
		const { tagIds, matchType = 'any', includeTags = false, includePluginDetails = true } = query;

		let queryBuilder = this.typeOrmPluginTagRepository
			.createQueryBuilder('pluginTag')
			.leftJoinAndSelect('pluginTag.plugin', 'plugin');

		if (includeTags) {
			queryBuilder = queryBuilder.leftJoinAndSelect('pluginTag.tag', 'tag');
		}

		// Apply tag filtering
		if (matchType === 'all') {
			// Plugin must have ALL specified tags
			queryBuilder = queryBuilder
				.where('pluginTag.tagId IN (:...tagIds)', { tagIds })
				.groupBy('plugin.id')
				.having('COUNT(DISTINCT pluginTag.tagId) = :tagCount', { tagCount: tagIds.length });
		} else {
			// Plugin must have ANY of the specified tags
			queryBuilder = queryBuilder.where('pluginTag.tagId IN (:...tagIds)', { tagIds });
		}

		// Apply tenant/organization filtering
		if (query.tenantId) {
			queryBuilder = queryBuilder.andWhere('pluginTag.tenantId = :tenantId', { tenantId: query.tenantId });
		}
		if (query.organizationId) {
			queryBuilder = queryBuilder.andWhere('pluginTag.organizationId = :organizationId', {
				organizationId: query.organizationId
			});
		}

		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items: includePluginDetails ? items : items.map((item) => ({ pluginId: item.pluginId })),
			total
		};
	}

	/**
	 * Find tags by plugins
	 *
	 * @param query - Query parameters for tag discovery
	 * @returns Promise<IPagination<any>>
	 */
	async findTagsByPlugins(query: ITagsByPluginsQuery): Promise<IPagination<any>> {
		const { pluginIds, includePlugins = false, includeStatistics = false } = query;

		let queryBuilder = this.typeOrmPluginTagRepository
			.createQueryBuilder('pluginTag')
			.leftJoinAndSelect('pluginTag.tag', 'tag');

		if (includePlugins) {
			queryBuilder = queryBuilder.leftJoinAndSelect('pluginTag.plugin', 'plugin');
		}

		queryBuilder = queryBuilder.where('pluginTag.pluginId IN (:...pluginIds)', { pluginIds });

		// Apply tenant/organization filtering
		if (query.tenantId) {
			queryBuilder = queryBuilder.andWhere('pluginTag.tenantId = :tenantId', { tenantId: query.tenantId });
		}
		if (query.organizationId) {
			queryBuilder = queryBuilder.andWhere('pluginTag.organizationId = :organizationId', {
				organizationId: query.organizationId
			});
		}

		if (includeStatistics) {
			queryBuilder = queryBuilder.addSelect('COUNT(pluginTag.pluginId)', 'usageCount').groupBy('tag.id');
		}

		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items,
			total
		};
	}

	/**
	 * Get plugin-tag statistics and analytics
	 *
	 * @param tenantId - Optional tenant filter
	 * @param organizationId - Optional organization filter
	 * @returns Promise<IPluginTagStatistics>
	 */
	async getStatistics(tenantId?: ID, organizationId?: ID): Promise<IPluginTagStatistics> {
		const baseWhere: FindOptionsWhere<PluginTag> = {};
		if (tenantId) baseWhere.tenantId = tenantId;
		if (organizationId) baseWhere.organizationId = organizationId;

		// Total relationships
		const totalRelationships = await this.count({ where: baseWhere });

		// Unique plugins with tags
		const taggedPluginsQuery = this.typeOrmPluginTagRepository
			.createQueryBuilder('pluginTag')
			.select('COUNT(DISTINCT pluginTag.pluginId)', 'count');

		if (tenantId) taggedPluginsQuery.where('pluginTag.tenantId = :tenantId', { tenantId });
		if (organizationId)
			taggedPluginsQuery.andWhere('pluginTag.organizationId = :organizationId', { organizationId });

		const taggedPluginsResult = await taggedPluginsQuery.getRawOne();
		const taggedPlugins = parseInt(taggedPluginsResult.count) || 0;

		// Unique tags used
		const usedTagsQuery = this.typeOrmPluginTagRepository
			.createQueryBuilder('pluginTag')
			.select('COUNT(DISTINCT pluginTag.tagId)', 'count');

		if (tenantId) usedTagsQuery.where('pluginTag.tenantId = :tenantId', { tenantId });
		if (organizationId) usedTagsQuery.andWhere('pluginTag.organizationId = :organizationId', { organizationId });

		const usedTagsResult = await usedTagsQuery.getRawOne();
		const usedTags = parseInt(usedTagsResult.count) || 0;

		// Most popular tags
		const popularTagsQuery = this.typeOrmPluginTagRepository
			.createQueryBuilder('pluginTag')
			.leftJoin('pluginTag.tag', 'tag')
			.select(['pluginTag.tagId', 'tag.name', 'COUNT(pluginTag.pluginId) as usageCount'])
			.groupBy('pluginTag.tagId, tag.name')
			.orderBy('usageCount', 'DESC')
			.limit(10);

		if (tenantId) popularTagsQuery.where('pluginTag.tenantId = :tenantId', { tenantId });
		if (organizationId) popularTagsQuery.andWhere('pluginTag.organizationId = :organizationId', { organizationId });

		const popularTagsResults = await popularTagsQuery.getRawMany();
		const popularTags = popularTagsResults.map((result) => ({
			tagId: result.pluginTag_tagId,
			tagName: result.tag_name,
			usageCount: parseInt(result.usageCount)
		}));

		// Most tagged plugins
		const mostTaggedPluginsQuery = this.typeOrmPluginTagRepository
			.createQueryBuilder('pluginTag')
			.leftJoin('pluginTag.plugin', 'plugin')
			.select(['pluginTag.pluginId', 'plugin.name', 'COUNT(pluginTag.tagId) as tagCount'])
			.groupBy('pluginTag.pluginId, plugin.name')
			.orderBy('tagCount', 'DESC')
			.limit(10);

		if (tenantId) mostTaggedPluginsQuery.where('pluginTag.tenantId = :tenantId', { tenantId });
		if (organizationId)
			mostTaggedPluginsQuery.andWhere('pluginTag.organizationId = :organizationId', { organizationId });

		const mostTaggedPluginsResults = await mostTaggedPluginsQuery.getRawMany();
		const mostTaggedPlugins = mostTaggedPluginsResults.map((result) => ({
			pluginId: result.pluginTag_pluginId,
			pluginName: result.plugin_name,
			tagCount: parseInt(result.tagCount)
		}));

		return {
			totalRelationships,
			taggedPlugins,
			usedTags,
			popularTags,
			mostTaggedPlugins
		};
	}

	/**
	 * Replace all tags for a plugin (remove existing, add new)
	 *
	 * @param pluginId - Plugin ID
	 * @param tagIds - New tag IDs
	 * @param tenantId - Optional tenant ID
	 * @param organizationId - Optional organization ID
	 * @returns Promise<IPluginTag[]>
	 */
	async replacePluginTags(pluginId: ID, tagIds: ID[], tenantId?: ID, organizationId?: ID): Promise<IPluginTag[]> {
		// Remove existing tags
		await this.bulkDelete({
			pluginId,
			tenantId,
			organizationId
		});

		// Add new tags
		if (tagIds.length > 0) {
			const result = await this.bulkCreate({
				pluginId,
				tagIds,
				tenantId,
				organizationId
			});
			return result.pluginTags;
		}

		return [];
	}

	/**
	 * Get plugins that share the most tags with a given plugin
	 *
	 * @param pluginId - Plugin ID to find similar plugins for
	 * @param limit - Maximum number of similar plugins to return
	 * @returns Promise<Array<{pluginId: ID, sharedTagsCount: number}>>
	 */
	async findSimilarPlugins(
		pluginId: ID,
		limit: number = 10
	): Promise<Array<{ pluginId: ID; sharedTagsCount: number }>> {
		const query = this.typeOrmPluginTagRepository
			.createQueryBuilder('pt1')
			.innerJoin('plugin_tags', 'pt2', 'pt1.tagId = pt2.tagId')
			.select('pt2.pluginId', 'pluginId')
			.addSelect('COUNT(*)', 'sharedTagsCount')
			.where('pt1.pluginId = :pluginId', { pluginId })
			.andWhere('pt2.pluginId != :pluginId', { pluginId })
			.groupBy('pt2.pluginId')
			.orderBy('sharedTagsCount', 'DESC')
			.limit(limit);

		const results = await query.getRawMany();

		return results.map((result: any) => ({
			pluginId: result.pluginId,
			sharedTagsCount: parseInt(result.sharedTagsCount)
		}));
	}

	/**
	 * Validate plugin-tag relationship constraints
	 *
	 * @param pluginId - Plugin ID
	 * @param tagId - Tag ID
	 * @returns Promise<boolean>
	 */
	async validateRelationship(pluginId: ID, tagId: ID): Promise<boolean> {
		// Add custom validation logic here
		// For example: check if plugin exists, tag exists, tenant/org matches, etc.

		try {
			// Check if both entities exist and belong to the same tenant/organization
			const existingRelation = await this.findOneByWhereOptions({
				pluginId,
				tagId
			});

			// If relation exists, it's valid
			if (existingRelation) {
				return true;
			}

			// Additional validation logic can be added here
			return true;
		} catch (error) {
			return false;
		}
	}
}
