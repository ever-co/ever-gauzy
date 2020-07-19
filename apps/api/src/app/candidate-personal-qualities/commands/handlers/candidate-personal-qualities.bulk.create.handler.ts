import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ICandidatePersonalQualitiesCreateInput } from '@gauzy/models';
import { CandidatePersonalQualitiesBulkCreateCommand } from '../candidate-personal-qualities.bulk.create.command';
import { CandidatePersonalQualitiesService } from '../../candidate-personal-qualities.service';
import { CandidatePersonalQualities } from '../../candidate-personal-qualities.entity';

@CommandHandler(CandidatePersonalQualitiesBulkCreateCommand)
export class CandidatePersonalQualitiesBulkCreateHandler
	implements ICommandHandler<CandidatePersonalQualitiesBulkCreateCommand> {
	constructor(
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService
	) {}

	public async execute(
		command: CandidatePersonalQualitiesBulkCreateCommand
	): Promise<CandidatePersonalQualities[]> {
		const { interviewId, personalQualities } = command;
		let personalQuality: ICandidatePersonalQualitiesCreateInput;
		const createInput: ICandidatePersonalQualitiesCreateInput[] = [];
		for (const item of personalQualities) {
			personalQuality = { name: item, interviewId: interviewId };
			createInput.push(personalQuality);
		}
		return await this.candidatePersonalQualitiesService.createBulk(
			createInput
		);
	}
}
