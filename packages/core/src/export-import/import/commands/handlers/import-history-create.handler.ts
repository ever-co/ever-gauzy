import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportHistoryService } from './../../import-history.service';
import { ImportHistoryCreateCommand } from '../import-history-create.command';

@CommandHandler(ImportHistoryCreateCommand)
export class ImportHistoryCreateHandler implements ICommandHandler<ImportHistoryCreateCommand> {
	
	constructor(
		@Inject(forwardRef(() => ImportHistoryService))
		private readonly _importHistoryService: ImportHistoryService
	) {}

	public async execute(event: ImportHistoryCreateCommand) {
		const { input } = event;
		console.log(input);
	}
}