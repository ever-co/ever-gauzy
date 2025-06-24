import { FileStorageProviderEnum } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, FileStorage } from '@gauzy/core';
import { Logger } from '@nestjs/common';
import { DataSource, EventSubscriber, InsertEvent, RemoveEvent } from 'typeorm';
import { Camshot } from '../entity/camshot.entity';

@EventSubscriber()
export class CamshotSubscriber extends BaseEntityEventSubscriber<Camshot> {
	private readonly logger = new Logger(CamshotSubscriber.name);

	constructor(readonly dataSource: DataSource) {
		super();
		dataSource.subscribers.push(this);
	}

	listenTo() {
		return Camshot;
	}

	private validateEntityFields(entity: Camshot): { valid: boolean; missingFields: string[] } {
		const missingFields = [];
		if (!entity.storageProvider) missingFields.push('storageProvider');
		if (!entity.fileKey) missingFields.push('fileKey');
		if (!entity.thumbKey) missingFields.push('thumbKey');
		return { valid: missingFields.length === 0, missingFields };
	}

	private logWarnMissingFields(entity: Camshot, context: string, missingFields: string[]) {
		this.logger.warn(
			`Missing ${missingFields.join(', ')} for Camshot entity with ID ${entity.id ?? 'N/A'} in ${context}`
		);
	}

	private logError(entity: Camshot, context: string, error: unknown) {
		this.logger.error(
			`Error in ${context} for Camshot entity with ID ${entity.id ?? 'N/A'}: ${(error as Error).message}`
		);
	}

	public override async beforeInsert(event: InsertEvent<Camshot>): Promise<void> {
		const entity = event.entity;
		if (!entity) {
			this.logger.warn(`Attempted to insert a null/undefined Camshot entity in beforeInsert.`);
			return;
		}
		const { valid, missingFields } = this.validateEntityFields(entity);
		if (!valid) {
			this.logWarnMissingFields(entity, 'beforeInsert', missingFields);
			return;
		}
		try {
			const provider = this.getFileStorageProvider(entity.storageProvider);
			const [fullUrl, thumbUrl] = await Promise.all([
				provider.url(entity.fileKey as string),
				provider.url(entity.thumbKey as string)
			]);
			entity.fullUrl = fullUrl;
			entity.thumbUrl = thumbUrl;
			this.logger.log(`Generated URL for Camshot entity with ID ${entity.id ?? 'N/A'}`);
		} catch (error) {
			this.logError(entity, 'beforeInsert', error);
		}
	}

	public override async afterRemove(event: RemoveEvent<Camshot>): Promise<void> {
		const entity = event.entity;
		if (!entity || !(entity instanceof Camshot)) {
			this.logger.warn(`Attempted to remove a null/undefined or invalid Camshot entity in afterRemove.`);
			return;
		}
		const { valid, missingFields } = this.validateEntityFields(entity);
		if (!valid) {
			this.logWarnMissingFields(entity, 'afterRemove', missingFields);
			return;
		}
		try {
			const provider = this.getFileStorageProvider(entity.storageProvider);
			await Promise.all([
				provider.deleteFile(entity.fileKey as string),
				provider.deleteFile(entity.thumbKey as string)
			]);
			this.logger.log(`Successfully deleted file for Camshot entity with ID ${entity.id}`);
		} catch (error) {
			this.logError(entity, 'afterRemove', error);
		}
	}

	private getFileStorageProvider(storageProvider: FileStorageProviderEnum | undefined) {
		return new FileStorage().setProvider(storageProvider as FileStorageProviderEnum).getProviderInstance();
	}
}
