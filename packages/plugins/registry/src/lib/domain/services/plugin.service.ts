import { CrudService } from '@gauzy/core';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AutoTagPluginCommand } from '../../application';
import { IPlugin } from '../../shared';
import { Plugin } from '../entities';
import { MikroOrmPluginRepository, TypeOrmPluginRepository } from '../repositories';

@Injectable()
export class PluginService extends CrudService<Plugin> {
	private readonly logger = new Logger(PluginService.name);

	constructor(
		public readonly typeOrmPluginRepository: TypeOrmPluginRepository,
		public readonly mikroOrmPluginRepository: MikroOrmPluginRepository,
		private readonly commandBus: CommandBus
	) {
		super(typeOrmPluginRepository, mikroOrmPluginRepository);
	}

	/**
	 * Create a plugin with auto-tagging functionality
	 *
	 * @param entity - Plugin creation data
	 * @returns Promise<Plugin>
	 */
	public async createWithAutoTagging(entity: Partial<IPlugin>): Promise<IPlugin> {
		try {
			this.logger.log(`Creating plugin: ${entity.name}`);

			// Create the plugin first
			const plugin = await super.create(entity);

			// Auto-tag the plugin after creation
			try {
				await this.commandBus.execute(
					new AutoTagPluginCommand(
						plugin.id,
						{
							name: plugin.name,
							description: plugin.description,
							type: plugin.type
						},
						{
							createMissingTags: true,
							overwriteExisting: false
						}
					)
				);
				this.logger.log(`Auto-tagging completed for plugin: ${plugin.id}`);
			} catch (taggingError) {
				// Log tagging error but don't fail plugin creation
				this.logger.warn(`Auto-tagging failed for plugin ${plugin.id}: ${taggingError.message}`);
			}

			return plugin as IPlugin;
		} catch (error) {
			this.logger.error(`Failed to create plugin: ${error.message}`, error.stack);
			throw error;
		}
	}

	public async validatePluginOwnership(pluginId: string, userId: string): Promise<boolean> {
		const plugin = await this.findOneOrFailByWhereOptions({ id: pluginId });

		if (!plugin.success) {
			throw new NotFoundException(`Plugin with ID "${pluginId}" not found.`);
		}
		if (plugin.record.uploadedById !== userId) {
			return false;
		}

		return true;
	}
}
