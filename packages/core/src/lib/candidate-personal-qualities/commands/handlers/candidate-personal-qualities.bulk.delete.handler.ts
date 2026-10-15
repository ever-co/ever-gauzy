import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { CandidatePersonalQualitiesBulkDeleteCommand } from '../candidate-personal-qualities.bulk.delete.command';
import { CandidatePersonalQualitiesService } from '../../candidate-personal-qualities.service';

@CommandHandler(CandidatePersonalQualitiesBulkDeleteCommand)
export class CandidatePersonalQualitiesBulkDeleteHandler implements ICommandHandler<CandidatePersonalQualitiesBulkDeleteCommand> {
	constructor(private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService) {}

	/**
	 * Removes the named personal qualities, or every quality of the sitting when none is named.
	 *
	 * @returns The delete result, so a caller can tell a removal from a call that matched nothing
	 * (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: CandidatePersonalQualitiesBulkDeleteCommand): Promise<DeleteResult> {
		const { id, personalQualities } = command;
		if (personalQualities) {
			return await this.candidatePersonalQualitiesService.deleteMany(personalQualities.map((item) => item.id));
		}

		const qualities = await this.candidatePersonalQualitiesService.getPersonalQualitiesByInterviewId(id);

		return await this.candidatePersonalQualitiesService.deleteMany(qualities.map((item) => item.id));
	}
}
