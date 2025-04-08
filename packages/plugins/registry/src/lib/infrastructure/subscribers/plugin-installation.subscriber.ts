import { Logger } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { PluginInstallation } from '../../domain/entities/plugin-installation.entity';
import { PluginVersionService } from '../../domain/services/plugin-version.service';
import { PluginService } from '../../domain/services/plugin.service';
import { PluginInstallationStatus } from '../../shared/models/plugin-installation.model';

@EventSubscriber()
export class PluginInstallationSubscriber implements EntitySubscriberInterface<PluginInstallation> {
	private readonly logger = new Logger(PluginInstallationSubscriber.name);

	constructor(
		private readonly pluginVersionService: PluginVersionService,
		private readonly pluginService: PluginService,
		readonly dataSource: DataSource
	) {
		dataSource.subscribers.push(this);
	}

	/**
	 * Indicates that this subscriber only listens to PluginInstallation events
	 */
	listenTo() {
		return PluginInstallation;
	}

	/**
	 * Called after entity insertion
	 */
	async afterInsert(event: InsertEvent<PluginInstallation>): Promise<void> {
		const installation = event.entity;

		// Early return if installation is invalid or not in INSTALLED status
		if (!installation || installation.status !== PluginInstallationStatus.INSTALLED) {
			this.logger.debug('Skipping download count increment: installation invalid or not in INSTALLED status');
			return;
		}

		// Early return if versionId is missing
		const { versionId, pluginId } = installation;
		if (!versionId || !pluginId) {
			this.logger.debug(`Plugin installation missing ${!versionId ? 'versionId' : 'pluginId'}, cannot process`);
			return;
		}

		try {
			this.logger.debug(`Processing installation for plugin: ${pluginId}, version: ${versionId}`);

			// Execute both operations in parallel for better performance
			await Promise.all([this.incrementDownloadCount(versionId), this.updatePluginLastDownloaded(pluginId)]);
		} catch (error) {
			// Log error but don't throw to prevent disrupting the main transaction
			this.logger.error(`Error processing plugin installation: ${error.message}`, error.stack);
		}
	}

	/**
	 * Increment the download count for a specific version
	 */
	private async incrementDownloadCount(versionId: string): Promise<void> {
		try {
			const version = await this.pluginVersionService.findOneByOptions({
				where: { id: versionId }
			});

			if (!version) {
				this.logger.warn(`Plugin version not found with ID: ${versionId}`);
				return;
			}

			// Increment the download count
			version.downloadCount = (version.downloadCount || 0) + 1;

			// Save the updated version
			await this.pluginVersionService.save(version);
			this.logger.debug(`Download count successfully incremented for version: ${versionId}`);
		} catch (error) {
			this.logger.error(`Error incrementing download count: ${error.message}`);
			throw error; // Re-throw to be caught by the parent try-catch
		}
	}

	/**
	 * Update the last downloaded timestamp for a plugin
	 */
	private async updatePluginLastDownloaded(pluginId: string): Promise<void> {
		try {
			await this.pluginService.update(pluginId, {
				lastDownloadedAt: new Date()
			});
			this.logger.debug(`Last download timestamp updated for plugin: ${pluginId}`);
		} catch (error) {
			this.logger.error(`Error updating plugin last download time: ${error.message}`);
			throw error; // Re-throw to be caught by the parent try-catch
		}
	}
}
