import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IImportRecord } from '@gauzy/contracts';
import { ImportRecordUpdateOrCreateCommand } from '../import-record-update-or-create.command';
import { ImportRecordService } from '../../import-record.service';
import { RequestContext } from '../../../../core/context';

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

		const { options, input = {} as IImportRecord } = event;
		const payload = Object.assign({}, options, input) as IImportRecord;

		const {
			sourceId,
			destinationId,
			entityType,
			tenantId = RequestContext.currentTenantId()
		} = payload;

		try {
			const record = await this._importRecordService.findOneByWhereOptions(options);
			if (record) {
				return {
					...await this._importRecordService.create({
						id: record.id,
						tenantId,
						sourceId,
						destinationId,
						entityType
					}),
					wasCreated: false
				};
			}
		} catch (error) {
			return {
				...await this._importRecordService.create({
					tenantId,
					sourceId,
					destinationId,
					entityType
				}),
				wasCreated: true
			};
		}
	}
}