import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordFirstOrCreateCommand } from '../import-record-first-or-create.command';
import { ImportRecordService } from '../../import-record.service';
import { ImportRecord } from './../../../../core/entities/internal';
import { RequestContext } from 'core';

@CommandHandler(ImportRecordFirstOrCreateCommand)
export class ImportRecordFirstOrCreateHandler 
	implements ICommandHandler<ImportRecordFirstOrCreateCommand> {
	
	constructor(
		@Inject(forwardRef(() => ImportRecordService))
		private readonly _importRecordService: ImportRecordService
	) {}

	public async execute(
		event: ImportRecordFirstOrCreateCommand
	): Promise<ImportRecord> {
		const { input } = event;
		const { sourceId, destinationId, entityType, tenantId } = input;
		const { record } = await this._importRecordService.findOneOrFail({
			where: {
				tenantId: tenantId || RequestContext.currentTenantId(),
				sourceId,
				destinationId,
				entityType
			}
		});
		if (!record) {
			const record = await this._importRecordService.create({
				tenantId: tenantId || RequestContext.currentTenantId(),
				sourceId,
				destinationId,
				entityType
			});
			return { ...record, wasCreated: true }; 
		}
		return { ...record, wasCreated: false };
	}
}