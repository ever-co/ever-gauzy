import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPluginTag } from '../../shared';
import { PluginTag } from '../entities/plugin-tag.entity';

/**
 * TypeORM repository for PluginTag entity.
 *
 * This repository provides TypeORM-specific data access methods for plugin-tag relationships.
 * It extends the TypeORM Repository class to provide database operations for managing
 * the many-to-many relationship between plugins and tags.
 *
 * Business Logic Capabilities:
 * - CRUD operations on plugin-tag associations
 * - Complex queries for plugin discovery by tags
 * - Bulk operations for tag management
 * - Performance-optimized queries with proper indexing
 */
@Injectable()
export class TypeOrmPluginTagRepository extends Repository<PluginTag> {
	constructor(
		@InjectRepository(PluginTag)
		readonly repository: Repository<PluginTag>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}

	/**
	 * Find all plugin-tag relationships for a specific plugin
	 *
	 * @param pluginId - The plugin ID to find tags for
	 * @param relations - Optional relations to include
	 * @returns Promise<PluginTag[]>
	 */
	async findByPluginId(pluginId: string, relations: string[] = ['tag']): Promise<IPluginTag[]> {
		return this.find({
			where: { pluginId },
			relations
		});
	}

	/**
	 * Find all plugin-tag relationships for a specific tag
	 *
	 * @param tagId - The tag ID to find plugins for
	 * @param relations - Optional relations to include
	 * @returns Promise<PluginTag[]>
	 */
	async findByTagId(tagId: string, relations: string[] = ['plugin']): Promise<IPluginTag[]> {
		return this.find({
			where: { tagId },
			relations
		});
	}

	/**
	 * Check if a plugin-tag relationship exists
	 *
	 * @param pluginId - The plugin ID
	 * @param tagId - The tag ID
	 * @returns Promise<boolean>
	 */
	async existsByPluginAndTag(pluginId: string, tagId: string): Promise<boolean> {
		const count = await this.count({
			where: { pluginId, tagId }
		});
		return count > 0;
	}

	/**
	 * Remove all tags from a plugin
	 *
	 * @param pluginId - The plugin ID to remove tags from
	 * @returns Promise<void>
	 */
	async removeAllTagsFromPlugin(pluginId: string): Promise<void> {
		await this.delete({ pluginId });
	}

	/**
	 * Remove all plugins from a tag
	 *
	 * @param tagId - The tag ID to remove plugins from
	 * @returns Promise<void>
	 */
	async removeAllPluginsFromTag(tagId: string): Promise<void> {
		await this.delete({ tagId });
	}

	/**
	 * Get plugins count by tag
	 *
	 * @param tagId - The tag ID
	 * @returns Promise<number>
	 */
	async getPluginCountByTag(tagId: string): Promise<number> {
		return this.count({
			where: { tagId }
		});
	}

	/**
	 * Get tags count by plugin
	 *
	 * @param pluginId - The plugin ID
	 * @returns Promise<number>
	 */
	async getTagCountByPlugin(pluginId: string): Promise<number> {
		return this.count({
			where: { pluginId }
		});
	}
}
