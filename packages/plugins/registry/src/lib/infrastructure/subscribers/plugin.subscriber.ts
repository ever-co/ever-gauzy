import { ID } from '@gauzy/contracts';
import { Logger } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { Plugin } from '../../domain/entities/plugin.entity';
import { PluginVersionService } from '../../domain/services/plugin-version.service';
import { PluginSourceService } from '../../domain/services/plugin-source.service';
import { PluginInstallationService } from '../../domain/services/plugin-installation.service';
import { RequestContext } from '@gauzy/core';
import { PluginInstallationStatus } from '../../shared/models/plugin-installation.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';

@EventSubscriber()
export class PluginSubscriber implements EntitySubscriberInterface<Plugin> {
	private readonly logger = new Logger(PluginSubscriber.name);

	constructor(
		private readonly pluginVersionService: PluginVersionService,
		private readonly pluginSourceService: PluginSourceService,
		private readonly pluginInstallationService: PluginInstallationService,
		readonly dataSource: DataSource
	) {
		dataSource.subscribers.push(this);
	}

	/**
	 * Indicates that this subscriber only listens to Plugin events
	 */
	listenTo() {
		return Plugin;
	}

	/**
	 * Lifecycle hook executed before inserting a new `Plugin` entity.
	 * Automatically sets the `uploadedAt` timestamp to the current date.
	 *
	 * @param {InsertEvent<Plugin>} event - The event object containing entity details.
	 * @returns {Promise<void>} A promise that resolves when the operation is complete.
	 */
	public async beforeInsert(event: InsertEvent<Plugin>): Promise<void> {
		if (!event.entity) return;

		const entity = event.entity;
		// Set uploadedBy and uploadedAt
		entity.uploadedById = RequestContext.currentEmployeeId();
		entity.uploadedAt = new Date();
		// Normalize string fields
		if (entity.name) entity.name = entity.name.trim();
		if (entity.author) entity.author = entity.author.trim();
		if (entity.license) entity.license = entity.license.trim();
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

			// Compute latest version
			const version = await this.computeLatestVersion(entity.id);

			// compute installation
			const installation = await this.pluginInstallationService.findOneOrFailByWhereOptions({
				pluginId: entity.id,
				installedById: RequestContext.currentEmployeeId(),
				status: PluginInstallationStatus.INSTALLED
			});

			// Compute latest source associated to version
			const source = version
				? await this.pluginSourceService.findOneOrFailByOptions({
						where: {
							version: {
								id: version.id
							}
						},
						order: {
							createdAt: 'DESC'
						}
				  })
				: { success: false, record: null };

			// Add the computed property to the entity
			entity.downloadCount = downloadCount;

			// Add the version
			entity.version = version;

			// Add the source
			entity.source = source.success ? source.record : null;

			entity.installed = installation.success;

			this.logger.debug(`Total downloads for plugin ${entity.id}: ${downloadCount}`);
		} catch (error) {
			this.logger.error(`Error computing total downloads for plugin ${entity.id}: ${error.message}`, error.stack);
			// Default to 0 to avoid breaking the application
			entity.downloadCount = 0;
			// Add default version
			entity.version = null;
			// Add default source
			entity.source = null;
			// Add default installed
			entity.installed = false;
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
			return 0;
		}
	}

	/**
	 * Find the latest version of a plugin using a query builder and semantic versioning principles
	 * @param pluginId The ID of the plugin
	 * @returns The latest version entity or undefined if none exists
	 */
	private async computeLatestVersion(pluginId: ID): Promise<IPluginVersion> {
		try {
			this.logger.debug(`Finding latest version for plugin: ${pluginId}`);

			// This approach uses a query builder to find the latest version
			// We'll need to use the repository from the PluginVersionService
			const queryBuilder = this.pluginVersionService.typeOrmPluginVersionRepository
				.createQueryBuilder('version')
				.where('version.pluginId = :pluginId', { pluginId })
				.orderBy('version.createdAt', 'DESC') // Temporary ordering to get a result
				.limit(1);

			// Execute the query
			const latestVersion = await queryBuilder.getOne();

			if (!latestVersion) {
				this.logger.debug(`No versions found for plugin: ${pluginId}`);
				return undefined;
			}

			// Get all versions to perform semantic versioning sort
			// This is needed because SQL doesn't natively support semantic version sorting
			const allVersions = await this.pluginVersionService.typeOrmPluginVersionRepository
				.createQueryBuilder('version')
				.leftJoinAndSelect('version.sources', 'sources')
				.where('version.pluginId = :pluginId', { pluginId })
				.getMany();

			// Sort versions based on semantic versioning (newest first)
			const sortedVersions = allVersions.sort((a, b) => {
				// Extract major, minor, patch numbers (ignore prerelease/build metadata)
				const versionA = a.number.split('-')[0].split('.').map(Number);
				const versionB = b.number.split('-')[0].split('.').map(Number);

				// Compare major version
				if (versionA[0] !== versionB[0]) {
					return versionB[0] - versionA[0];
				}

				// Compare minor version
				if (versionA[1] !== versionB[1]) {
					return versionB[1] - versionA[1];
				}

				// Compare patch version
				return versionB[2] - versionA[2];
			});

			this.logger.debug(`Latest version for plugin ${pluginId}: ${sortedVersions[0]?.number}`);
			return sortedVersions[0];
		} catch (error) {
			this.logger.error(`Error finding latest version for plugin ${pluginId}: ${error.message}`, error.stack);
			return null;
		}
	}
}
