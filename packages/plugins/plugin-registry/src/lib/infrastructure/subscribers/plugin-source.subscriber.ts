import { FileStorageProviderEnum, PluginSourceType } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, FileStorage } from '@gauzy/core';
import { Logger } from '@nestjs/common';
import { DataSource, EventSubscriber, InsertEvent, RemoveEvent } from 'typeorm';
import { PluginSource } from '../../domain/entities/plugin-source.entity';

@EventSubscriber()
export class PluginSourceSubscriber extends BaseEntityEventSubscriber<PluginSource> {
	private readonly logger = new Logger(PluginSourceSubscriber.name);

	constructor(readonly dataSource: DataSource) {
		super();
		dataSource.subscribers.push(this);
	}

	listenTo() {
		return PluginSource;
	}

	public override async beforeInsert(event: InsertEvent<PluginSource>): Promise<void> {
		const entity = event.entity;

		if (entity.type !== PluginSourceType.GAUZY) {
			return;
		}

		try {
			const { storageProvider, fileKey } = entity;
			if (!storageProvider || !fileKey) {
				this.logger.warn(
					`Missing storageProvider or fileKey for PluginSource entity with ID ${entity.id ?? 'N/A'}`
				);
				return;
			}

			const provider = this.getFileStorageProvider(storageProvider);
			entity.url = await provider.url(fileKey);
			this.logger.log(`Generated URL for PluginSource entity with ID ${entity.id ?? 'N/A'}`);
		} catch (error) {
			this.logger.error(
				`Error generating URL for PluginSource entity with ID ${entity.id ?? 'N/A'}: ${
					(error as Error).message
				}`
			);
		}
	}

	public override async afterRemove(event: RemoveEvent<PluginSource>): Promise<void> {
		const entity = event.entity;
		if (!entity || !(entity instanceof PluginSource)) {
			return;
		}

		if (entity.type !== PluginSourceType.GAUZY) {
			return;
		}

		try {
			const { id: entityId, storageProvider, fileKey } = entity;
			if (!storageProvider || !fileKey) {
				this.logger.warn(`Missing storageProvider or fileKey for PluginSource entity with ID ${entityId}`);
				return;
			}

			const provider = this.getFileStorageProvider(storageProvider);
			await provider.deleteFile(fileKey);

			this.logger.log(`Successfully deleted file for PluginSource entity with ID ${entityId}`);
		} catch (error) {
			this.logger.error(
				`Error deleting file for PluginSource entity with ID ${entity.id}: ${(error as Error).message}`
			);
		}
	}

	private getFileStorageProvider(storageProvider: string) {
		return new FileStorage().setProvider(storageProvider as FileStorageProviderEnum).getProviderInstance();
	}
}
