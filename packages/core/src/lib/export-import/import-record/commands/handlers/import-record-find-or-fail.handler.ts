import { forwardRef, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordService } from './../../import-record.service';
import { ImportRecordFindOrFailCommand } from './../import-record-find-or-fail.command';
import { ITryRequest } from './../../../../core/crud/try-request';
import { ImportRecord } from './../../import-record.entity';

@CommandHandler(ImportRecordFindOrFailCommand)
export class ImportRecordFindOrFailHandler
	implements ICommandHandler<ImportRecordFindOrFailCommand> {

	constructor(
		@Inject(forwardRef(() => ImportRecordService))
		private readonly _importRecordService: ImportRecordService
	) {}

	public async execute(
		event: ImportRecordFindOrFailCommand
	): Promise<ITryRequest<ImportRecord>> {
		try {
			const { input } = event;
			return await this._importRecordService.findOneOrFailByWhereOptions(input);
		} catch (error) {
			throw new NotFoundException(`The import record was not found`);
		}
	}
}