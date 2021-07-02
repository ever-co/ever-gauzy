import { forwardRef, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordService } from 'export-import/import/import-record.service';
import { ImportRecordFindOrFailCommand } from './../import-record-find-or-fail.command';
import { ITryRequest } from './../../../../core/crud/try-request';

@CommandHandler(ImportRecordFindOrFailCommand)
export class ImportRecordFindOrFailHandler 
	implements ICommandHandler<ImportRecordFindOrFailCommand> {
	
	constructor(
		@Inject(forwardRef(() => ImportRecordService))
		private readonly _importRecordService: ImportRecordService
	) {}

	public async execute(
		event: ImportRecordFindOrFailCommand
	): Promise<ITryRequest> {
		try {
			const { input = [] } = event; 
			return await this._importRecordService.findOneOrFail({
				where: input
			});
		} catch (error) {
			throw new NotFoundException(`The import record was not found`);
		}
	}
}