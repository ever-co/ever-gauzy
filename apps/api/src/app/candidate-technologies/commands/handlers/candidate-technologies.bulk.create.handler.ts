import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateTechnologiesBulkCreateCommand } from '../candidate-technologies.bulk.create.command';
import { CandidateTechnologiesService } from '../../candidate-technologies.service';
import { CandidateTechnologies } from '../../candidate-technologies.entity';
import { ICandidateTechnologiesCreateInput } from '@gauzy/models';

@CommandHandler(CandidateTechnologiesBulkCreateCommand)
export class CandidateTechnologiesBulkCreateHandler
	implements ICommandHandler<CandidateTechnologiesBulkCreateCommand> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService
	) {}

	public async execute(
		command: CandidateTechnologiesBulkCreateCommand
	): Promise<CandidateTechnologies[]> {
		const { interviewId, technologies } = command;
		let technology: ICandidateTechnologiesCreateInput;
		const createInput: ICandidateTechnologiesCreateInput[] = [];
		for (const item of technologies) {
			technology = { name: item, interviewId: interviewId };
			createInput.push(technology);
		}
		return await this.candidateTechnologiesService.createBulk(createInput);
	}
}
