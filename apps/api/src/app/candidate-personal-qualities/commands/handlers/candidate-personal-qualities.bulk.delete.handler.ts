import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidatePersonalQualitiesBulkDeleteCommand } from '../candidate-personal-qualities.bulk.delete.command';
import { CandidatePersonalQualitiesService } from '../../candidate-personal-qualities.service';

@CommandHandler(CandidatePersonalQualitiesBulkDeleteCommand)
export class CandidatePersonalQualitiesBulkDeleteHandler
	implements ICommandHandler<CandidatePersonalQualitiesBulkDeleteCommand> {
	constructor(
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService
	) {}

	public async execute(
		command: CandidatePersonalQualitiesBulkDeleteCommand
	): Promise<any> {
		const { id } = command;
		const personalQualities = await this.candidatePersonalQualitiesService.getPersonalQualitiesByInterviewId(
			id
		);
		await this.candidatePersonalQualitiesService.deleteBulk(
			personalQualities.map((item) => item.id)
		);

		return;
	}
}
