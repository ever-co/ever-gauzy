import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordService } from './../../import-record.service';
import { ImportRecordCreateCommand } from '../import-record-create.command';

@CommandHandler(ImportRecordCreateCommand)
export class ImportRecordCreateHandler implements ICommandHandler<ImportRecordCreateCommand> {
	
	constructor(
		@Inject(forwardRef(() => ImportRecordService))
		private readonly _importRecordService: ImportRecordService
	) {}

	public async execute(event: ImportRecordCreateCommand) {
		const { input } = event;
		console.log(input, this._importRecordService);
	}
}