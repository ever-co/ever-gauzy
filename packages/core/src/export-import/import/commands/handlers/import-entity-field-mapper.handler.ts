import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportEntityFieldMapperCommand } from '../import-entity-field-mapper.command';

@CommandHandler(ImportEntityFieldMapperCommand)
export class ImportEntityFieldMapperHandler 
	implements ICommandHandler<ImportEntityFieldMapperCommand> {
	
	constructor() {}

	public async execute(
		event: ImportEntityFieldMapperCommand
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