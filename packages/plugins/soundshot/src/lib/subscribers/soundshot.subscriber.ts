import { BaseEntityEventSubscriber } from '@gauzy/core';
import { Logger } from '@nestjs/common';
import { DataSource, EventSubscriber, InsertEvent, RemoveEvent } from 'typeorm';
import { Soundshot } from '../entity/soundshot.entity';
import { SoundshotService } from '../services/soundshot.service';

@EventSubscriber()
export class SoundshotSubscriber extends BaseEntityEventSubscriber<Soundshot> {
	private readonly logger = new Logger(SoundshotSubscriber.name);

	constructor(readonly dataSource: DataSource, private readonly soundshotService: SoundshotService) {
		super();
		dataSource.subscribers.push(this);
	}

	listenTo() {
		return Soundshot;
	}

	private validateAndHandleMissingFields(entity: Soundshot | undefined, context: string): boolean {
		if (!entity) {
			this.logger.warn(`Attempted to process a null/undefined Soundshot entity in ${context}.`);
			return false;
		}

		const missingFields = [];
		if (!entity.storageProvider) missingFields.push('storageProvider');
		if (!entity.fileKey) missingFields.push('fileKey');

		if (missingFields.length > 0) {
			this.logger.warn(
				`Missing ${missingFields.join(', ')} for Soundshot entity with ID ${entity.id ?? 'N/A'} in ${context}`
			);
			return false;
		}
		return true;
	}

	private logError(entity: Soundshot, context: string, error: unknown) {
		this.logger.error(`Error in ${context} for Soundshot entity with ID ${entity.id ?? 'N/A'}.`, error);
	}

	public override async beforeInsert(event: InsertEvent<Soundshot>): Promise<void> {
		const entity = event.entity;
		if (!this.validateAndHandleMissingFields(entity, 'beforeInsert')) {
			return;
		}

		try {
			const provider = this.soundshotService.getFileStorageProviderInstance(entity.storageProvider);
			const fullUrl = await provider.url(entity.fileKey as string);
			entity.fullUrl = fullUrl;
			this.logger.log(`Generated URL for Soundshot entity with ID ${entity.id ?? 'N/A'}`);
		} catch (error) {
			this.logError(entity, 'beforeInsert', error);
			throw error;
		}
	}

	public override async afterRemove(event: RemoveEvent<Soundshot>): Promise<void> {
		const entity = event.entity;
		if (!this.validateAndHandleMissingFields(entity, 'afterRemove')) {
			return;
		}

		try {
			const provider = this.soundshotService.getFileStorageProviderInstance(entity.storageProvider);
			await provider.deleteFile(entity.fileKey as string);
			this.logger.log(`Successfully deleted file for Soundshot entity with ID ${entity.id}`);
		} catch (error) {
			this.logError(entity, 'afterRemove', error);
		}
	}
}
