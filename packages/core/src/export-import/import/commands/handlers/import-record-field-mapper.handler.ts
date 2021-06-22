import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportRecordFieldMapperCommand } from '../import-record-field-mapper.command';

@CommandHandler(ImportRecordFieldMapperCommand)
export class ImportRecordFieldMapperHandler 
	implements ICommandHandler<ImportRecordFieldMapperCommand> {
	
	constructor() {}

	public async execute(
		event: ImportRecordFieldMapperCommand
	): Promise<any> {
		const { repository, where } = event;
		try {
			return await repository.findOneOrFail({
				where
			});
		} catch (error) {
			return false	
		}
	}
}