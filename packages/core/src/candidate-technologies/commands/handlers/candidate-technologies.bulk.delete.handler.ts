import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateTechnologiesBulkDeleteCommand } from '../candidate-technologies.bulk.delete.command';
import { CandidateTechnologiesService } from '../../candidate-technologies.service';

@CommandHandler(CandidateTechnologiesBulkDeleteCommand)
export class CandidateTechnologiesBulkDeleteHandler
	implements ICommandHandler<CandidateTechnologiesBulkDeleteCommand> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService
	) {}

	public async execute(
		command: CandidateTechnologiesBulkDeleteCommand
	): Promise<any> {
		const { id, technologies } = command;

		if (technologies) {
			await this.candidateTechnologiesService.deleteBulk(
				technologies.map((item) => item.id)
			);
		} else {
			const tech = await this.candidateTechnologiesService.getTechnologiesByInterviewId(
				id['id']
			);
			await this.candidateTechnologiesService.deleteBulk(
				tech.map((item) => item.id)
			);
		}
		return;
	}
}
