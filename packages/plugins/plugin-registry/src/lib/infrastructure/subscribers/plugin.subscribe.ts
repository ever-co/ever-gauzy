import { Injectable, Logger } from '@nestjs/common';
import { EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { Plugin } from '../../domain/entities/plugin.entity';
import { PluginVersionService } from '../../domain/services/plugin-version.service';

@Injectable()
@EventSubscriber()
export class PluginSubscriber implements EntitySubscriberInterface<Plugin> {
	private readonly logger = new Logger(PluginSubscriber.name);

	constructor(private readonly pluginVersionService: PluginVersionService) {}

	/**
	 * Indicates that this subscriber only listens to Plugin events
	 */
	listenTo() {
		return Plugin;
	}

	/**
	 * Called after entity is loaded from the database
	 * Computes the total download count from all versions
	 */
	public async afterLoad(entity: Plugin): Promise<void> {
		if (!entity || !entity.id) {
			return;
		}

		try {
			this.logger.debug(`Computing total download count for plugin: ${entity.id}`);

			// Compute total download count from all versions
			const downloadCount = await this.computeDownloadCount(entity.id);

			// Add the computed property to the entity
			entity.downloadCount = downloadCount;

			this.logger.debug(`Total downloads for plugin ${entity.id}: ${downloadCount}`);
		} catch (error) {
			this.logger.error(`Error computing total downloads for plugin ${entity.id}: ${error.message}`, error.stack);
			// Default to 0 to avoid breaking the application
			entity.downloadCount = 0;
		}
	}

	/**
	 * Compute total downloads from all versions of a plugin
	 */
	private async computeDownloadCount(pluginId: string): Promise<number> {
		try {
			// Create a query builder to sum the downloadCount from all versions
			const total = await this.pluginVersionService.getTotalDownloadCount(pluginId);
			// Return the total, or 0 if no results
			return total || 0;
		} catch (error) {
			this.logger.error(`Error in computeTotalDownloads query: ${error.message}`);
			throw error;
		}
	}
}
