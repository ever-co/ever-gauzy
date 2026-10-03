import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from './../../../../core';
import { ImportRecordFindOrFailCommand } from './../../../import-record';
import { ExportEntityClass, omitExportRedactionPlaceholders } from '../../../export-redact.decorator';
import { ImportEntityFieldMapOrCreateCommand } from './../import-entity-field-map-or-create.command';
import { isEmailAddressChange, UNCONFIRMED_EMAIL_STATE } from '../../../../user/email-change.util';

/** Table of the `User` entity (`@MultiORMEntity('user')`). */
const USER_TABLE = 'user';

@CommandHandler(ImportEntityFieldMapOrCreateCommand)
export class ImportEntityFieldMapOrCreateHandler implements ICommandHandler<ImportEntityFieldMapOrCreateCommand> {
	constructor(private readonly _commandBus: CommandBus) {}

	public async execute(event: ImportEntityFieldMapOrCreateCommand): Promise<any> {
		const { repository, where, entity, sourceId } = event;
		try {
			if (isNotEmpty(where)) {
				return await repository.findOneOrFail({
					where,
					order: {
						createdAt: 'DESC'
					}
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
					// This row was imported before, so this is an UPDATE of a live row. An export
					// archive carries placeholders where credentials were (GHSA-j5h5-r956-rxc3); writing
					// them back would replace working tokens and password digests with masks and nulls.
					let row = omitExportRedactionPlaceholders(repository.metadata.target as ExportEntityClass, entity);
					if (repository.metadata.tableName === USER_TABLE) {
						row = await this._withServerOwnedEmailConfirmation(repository, destinationId, row);
					}
					return await repository.save({
						id: destinationId,
						...row
					});
				}
				throw new NotFoundException(`The import record was not found`);
			} catch (error) {
				return await this._create(repository, entity);
			}
		}
	}

	/**
	 * A user's e-mail confirmation (and its pending link/code) is only ever set by the server: by
	 * the confirmation flow, for the address it was sent to. An archive row must not set it — that
	 * would mark any address as confirmed, or plant a code the confirm endpoint accepts — and an
	 * archive row that moves the user to a different address resets it, as every other address
	 * change does. New rows are unaffected: those columns are not inserted.
	 */
	private async _withServerOwnedEmailConfirmation(repository, id: string, row: Record<string, any>) {
		const {
			emailVerifiedAt: _emailVerifiedAt,
			emailToken: _emailToken,
			code: _code,
			codeExpireAt: _codeExpireAt,
			...rest
		} = row;
		if (!('email' in rest)) {
			return rest;
		}
		const current = await repository.findOne({ where: { id }, select: { id: true, email: true } });
		return isEmailAddressChange(current?.email, rest.email) ? { ...rest, ...UNCONFIRMED_EMAIL_STATE } : rest;
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
