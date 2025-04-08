import { BaseEntityEventSubscriber } from '@gauzy/core';
import { Logger } from '@nestjs/common';
import { DataSource, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { PluginVersion } from '../../domain/entities/plugin-version.entity';
import { PluginSecurityService } from '../../domain/services/plugin-security.service';

/**
 * Subscriber that handles security-related operations for PluginVersion entities.
 * Automatically generates checksums and signatures for newly created plugin versions.
 */
@EventSubscriber()
export class PluginVersionSubscriber extends BaseEntityEventSubscriber<PluginVersion> {
	private readonly logger = new Logger(PluginVersionSubscriber.name);

	constructor(private readonly pluginSecurityService: PluginSecurityService, readonly dataSource: DataSource) {
		super();
		dataSource.subscribers.push(this);
	}

	/**
	 * Specifies the entity this subscriber listens to
	 */
	listenTo() {
		return PluginVersion;
	}

	/**
	 * After insert hook to generate and assign security credentials
	 * @param event The insert event containing the newly created entity
	 */
	public override async afterInsert(event: InsertEvent<PluginVersion>): Promise<void> {
		try {
			const entity = event.entity;

			// Type guard to ensure we're working with the correct entity
			if (!entity) {
				this.logger.warn(`Expected Plugin Version entity`);
				return;
			}

			// Generate security credentials concurrently for better performance
			const [checksum, signature] = await Promise.all([
				this.pluginSecurityService.generateChecksum(entity.id),
				this.pluginSecurityService.generateSignature(entity.id)
			]);

			// Update entity with generated security credentials
			entity.checksum = checksum;
			entity.signature = signature;

			// Save the updated entity
			await event.manager.save(entity);

			this.logger.debug(`Generated security credentials for plugin version ID: ${entity.id}`);
		} catch (error) {
			this.logger.error(
				`Failed to generate security credentials for plugin version: ${error.message}`,
				error.stack
			);
		}
	}

	/**
	 * Prevent signature or checksum modification after creation
	 */
	public async beforeUpdate(event: UpdateEvent<PluginVersion>): Promise<void> {
		const entity = event.entity as PluginVersion;
		const existingEntity = await event.manager.findOne(PluginVersion, {
			where: { id: entity.id }
		});

		if (!existingEntity) return;

		// Prevent modification of security credentials
		if (entity.checksum !== existingEntity.checksum || entity.signature !== existingEntity.signature) {
			this.logger.warn(`Attempt to modify security credentials for plugin version ID: ${entity.id}`);
			entity.checksum = existingEntity.checksum;
			entity.signature = existingEntity.signature;
		}
	}
}
