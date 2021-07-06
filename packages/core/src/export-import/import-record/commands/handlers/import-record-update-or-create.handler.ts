import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IImportRecord, IImportRecordFind } from '@gauzy/contracts';
import { ImportRecordUpdateOrCreateCommand } from '../import-record-update-or-create.command';
import { ImportRecordService } from '../../import-record.service';
import { RequestContext } from '../../../../core';

@CommandHandler(ImportRecordUpdateOrCreateCommand)
export class ImportRecordUpdateOrCreateHandler 
	implements ICommandHandler<ImportRecordUpdateOrCreateCommand> {
	
	constructor(
		@Inject(forwardRef(() => ImportRecordService))
		private readonly _importRecordService: ImportRecordService
	) {}

	public async execute(
		event: ImportRecordUpdateOrCreateCommand
	): Promise<IImportRecord> {
		const { find = {} as IImportRecordFind, input = {} as IImportRecord } = event;
		const { record } = await this._importRecordService.findOneOrFail({
			where: {
				...find
			}
		});
		const payload = Object.assign({}, find, input) as IImportRecord;
		const { sourceId, destinationId, entityType, tenantId } = payload;

		if (!record) {
			return { 
				...await this._importRecordService.create({
					tenantId: tenantId || RequestContext.currentTenantId(),
					sourceId,
					destinationId,
					entityType
				}), 
				wasCreated: true 
			}; 
		} else {
			return { 
				...await this._importRecordService.create({
					id: record.id,
					tenantId: tenantId || RequestContext.currentTenantId(),
					sourceId,
					destinationId,
					entityType
				}), 
				wasCreated: false 
			};
		}
	}
}