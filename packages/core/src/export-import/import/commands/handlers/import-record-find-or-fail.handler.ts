import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordFindOrFailCommand } from './../import-record-find-or-fail.command';

@CommandHandler(ImportRecordFindOrFailCommand)
export class ImportRecordFindOrFailHandler 
	implements ICommandHandler<ImportRecordFindOrFailCommand> {
	
	constructor() {}

	public async execute(
		event: ImportRecordFindOrFailCommand
	): Promise<any> {
		console.log(event);
	}
}