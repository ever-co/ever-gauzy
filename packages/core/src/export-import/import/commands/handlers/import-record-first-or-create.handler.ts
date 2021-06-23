import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordFirstOrCreateCommand } from '../import-record-first-or-create.command';
import { ImportRecordService } from '../../import-record.service';
import { ImportRecord } from './../../../../core/entities/internal';

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
		const { tenantId, sourceId, destinationId, entityType } = input;
		
		const { record } = await this._importRecordService.findOneOrFail({
			where: {
				tenantId,
				sourceId,
				destinationId,
				entityType
			}
		});
		if (!record) {
			const record = await this._importRecordService.create({
				tenantId,
				sourceId,
				destinationId,
				entityType
			});
			return { ...record, wasCreated: true }; 
		}
		return { ...record, wasCreated: false };
	}
}