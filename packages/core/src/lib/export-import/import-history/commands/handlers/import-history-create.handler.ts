import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportHistoryService } from './../../import-history.service';
import { ImportHistoryCreateCommand } from '../import-history-create.command';
import { ImportHistory } from './../../import-history.entity';

@CommandHandler(ImportHistoryCreateCommand)
export class ImportHistoryCreateHandler implements ICommandHandler<ImportHistoryCreateCommand> {

	constructor(
		@Inject(forwardRef(() => ImportHistoryService))
		private readonly _importHistoryService: ImportHistoryService
	) { }

	public async execute(event: ImportHistoryCreateCommand): Promise<ImportHistory> {
		try {
			const { input } = event;
			return await this._importHistoryService.create(input);
		} catch (error) {
			console.log('Error while creating import history', error);
		}
	}
}
