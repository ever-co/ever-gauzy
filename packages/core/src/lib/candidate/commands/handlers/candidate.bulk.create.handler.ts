import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ICandidate, ICandidateCreateInput } from '@gauzy/contracts';
import { CandidateBulkCreateCommand } from '../candidate.bulk.create.command';
import { CandidateCreateCommand } from '../candidate.create.command';

@CommandHandler(CandidateBulkCreateCommand)
export class CandidateBulkCreateHandler
	implements ICommandHandler<CandidateBulkCreateCommand> {

	constructor(
		private readonly _commandBus: CommandBus
	) {}

	public async execute(
		command: CandidateBulkCreateCommand
	): Promise<ICandidate[]> {
		try {
			const { input, languageCode, originUrl } = command;
			return await Promise.all(
				input.map(
					async (entity: ICandidateCreateInput) => {
						return await this._commandBus.execute(
							new CandidateCreateCommand(
								entity,
								languageCode,
								originUrl
							)
						);
					}
				)
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
