import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/common';
import { ImportEntityFieldMapOrCreateCommand } from './../import-entity-field-map-or-create.command';
import { RequestContext } from './../../../../core';
import { ImportRecordFindOrFailCommand } from './../import-record-find-or-fail.command';

@CommandHandler(ImportEntityFieldMapOrCreateCommand)
export class ImportEntityFieldMapOrCreateHandler 
	implements ICommandHandler<ImportEntityFieldMapOrCreateCommand> {
	
	constructor(
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		event: ImportEntityFieldMapOrCreateCommand
	): Promise<any> {
		const { repository, where, entity, sourceId } = event;
		try {
			if (isNotEmpty(where)) {
				return await repository.findOneOrFail({
					where
				});
			}
			throw new NotFoundException();
		} catch (error) {
			try {
				const { record, success } = await this.commandBus.execute(
					new ImportRecordFindOrFailCommand({
						tenantId: RequestContext.currentTenantId(),
						sourceId,
						entityType: repository.metadata.tableName
					})
				);
				if (success) {
					console.log(record.destinationId);
					return await repository.findOne(record.destinationId);
				}
				throw new NotFoundException(`The import record was not found`);
			} catch (error) {
				console.log(error);
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
}