import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportEntityFieldMapOrCreateCommand } from '../import-entity-field-map-or-create.command';

@CommandHandler(ImportEntityFieldMapOrCreateCommand)
export class ImportEntityFieldMapOrCreateHandler 
	implements ICommandHandler<ImportEntityFieldMapOrCreateCommand> {
	
	constructor() {}

	public async execute(
		event: ImportEntityFieldMapOrCreateCommand
	): Promise<any> {
		const { repository, where, entity } = event;
		try {
			return await repository.findOneOrFail({
				where
			});
		} catch (error) {
			const obj = repository.create(entity);
			try {
				// https://github.com/Microsoft/TypeScript/issues/21592
				return await repository.save(obj as any);
			} catch (err) {
				throw new BadRequestException(err);
			}
		}
	}
}