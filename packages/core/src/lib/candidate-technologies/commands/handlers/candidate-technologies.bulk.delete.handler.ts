import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { CandidateTechnologiesBulkDeleteCommand } from '../candidate-technologies.bulk.delete.command';
import { CandidateTechnologiesService } from '../../candidate-technologies.service';

@CommandHandler(CandidateTechnologiesBulkDeleteCommand)
export class CandidateTechnologiesBulkDeleteHandler implements ICommandHandler<CandidateTechnologiesBulkDeleteCommand> {
	constructor(private readonly candidateTechnologiesService: CandidateTechnologiesService) {}

	/**
	 * Removes the named technologies, or every technology of the sitting when none is named.
	 *
	 * @returns The delete result, so a caller can tell a removal from a call that matched nothing
	 * (`affected: 0`) — the GraphQL field answers from it.
	 */
	public async execute(command: CandidateTechnologiesBulkDeleteCommand): Promise<DeleteResult> {
		const { id, technologies } = command;

		if (technologies) {
			return await this.candidateTechnologiesService.deleteMany(technologies.map((item) => item.id));
		}

		const rows = await this.candidateTechnologiesService.getTechnologiesByInterviewId(id);

		return await this.candidateTechnologiesService.deleteMany(rows.map((item) => item.id));
	}
}
