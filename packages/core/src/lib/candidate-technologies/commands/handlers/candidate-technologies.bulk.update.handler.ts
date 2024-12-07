import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CandidateTechnologiesService } from '../../candidate-technologies.service';
import { CandidateTechnologiesBulkUpdateCommand } from '../candidate-technologies.bulk.update.command';

@CommandHandler(CandidateTechnologiesBulkUpdateCommand)
export class CandidateTechnologiesBulkUpdateHandler
	implements ICommandHandler<CandidateTechnologiesBulkUpdateCommand> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService
	) {}

	public async execute(
		command: CandidateTechnologiesBulkUpdateCommand
	): Promise<any> {
		const { technologies } = command;
		// TO DO
		technologies.forEach((item) =>
			this.candidateTechnologiesService.update(item.id, { ...item })
		);
		return;
	}
}
