import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from './../../../../core';
import { ImportEntityFieldMapOrCreateCommand } from './../import-entity-field-map-or-create.command';
import { ImportRecordFindOrFailCommand } from './../import-record-find-or-fail.command';

@CommandHandler(ImportEntityFieldMapOrCreateCommand)
export class ImportEntityFieldMapOrCreateHandler 
	implements ICommandHandler<ImportEntityFieldMapOrCreateCommand> {
	
	constructor(
		private readonly _commandBus: CommandBus
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
				const { record, success } = await this._commandBus.execute(
					new ImportRecordFindOrFailCommand({
						tenantId: RequestContext.currentTenantId(),
						sourceId,
						entityType: repository.metadata.tableName
					})
				);
				if (success && record) {
					const { destinationId } = record;
					return await this._create(repository, { id: destinationId, ...entity });
				}
				throw new NotFoundException(`The import record was not found`);
			} catch (error) {
				return await this._create(repository, entity);
			}
		}
	}

	private async _create(repository, entity) {
		try {
			const obj = repository.create(entity);
			// https://github.com/Microsoft/TypeScript/issues/21592
			return await repository.save(obj as any);
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}