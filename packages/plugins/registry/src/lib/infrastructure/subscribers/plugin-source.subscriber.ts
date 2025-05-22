import { FileStorageProviderEnum, IPluginSource, PluginSourceType } from '@gauzy/contracts';
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

	public async afterLoad(entity: PluginSource): Promise<void> {
		if (!entity || !entity.id) {
			return;
		}
		entity.fullName = this.generateFullName(entity);
	}

	/**
	 * Generates a full name for a plugin source based on its type and properties
	 * @param pluginSource The plugin source to generate the full name for
	 * @returns A descriptive full name for the plugin source
	 */
	private generateFullName(source: IPluginSource): string {
		const { type, operatingSystem, architecture, version } = source;

		// Base parts that are common to all types
		const baseParts = [`${version ? 'v' + version.number : undefined}`, operatingSystem, architecture];

		// Type-specific parts
		let typeSpecificPart = '';

		switch (type) {
			case PluginSourceType.CDN:
				if (source.url) {
					try {
						const url = new URL(source.url);
						typeSpecificPart = `cdn-${url.hostname}`;
					} catch {
						typeSpecificPart = 'cdn-source';
					}
				} else {
					typeSpecificPart = 'cdn-source';
				}
				break;

			case PluginSourceType.NPM:
				typeSpecificPart = source.scope ? `npm-${source.scope}/${source.name}` : `npm-${source.name}`;
				if (source.registry) {
					try {
						const registryUrl = new URL(source.registry);
						typeSpecificPart += `-${registryUrl.hostname}`;
					} catch {
						// Ignore invalid registry URLs
					}
				}
				break;

			case PluginSourceType.GAUZY:
				typeSpecificPart = source.fileName ? `file-${source.fileName.replace('.zip', '')}` : 'uploaded-file';
				break;

			default:
				typeSpecificPart = 'unknown-source';
		}

		// Combine all parts and clean up any undefined/null values
		const allParts = [...baseParts, typeSpecificPart].filter((part) => !!part);

		// Join with underscores and convert to lowercase for consistency
		return allParts.join('_').toLowerCase();
	}

	private getFileStorageProvider(storageProvider: string) {
		return new FileStorage().setProvider(storageProvider as FileStorageProviderEnum).getProviderInstance();
	}
}
