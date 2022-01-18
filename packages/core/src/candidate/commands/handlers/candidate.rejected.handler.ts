import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, ICandidate } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateRejectedCommand } from '../candidate.rejected.command';

@CommandHandler(CandidateRejectedCommand)
export class CandidateRejectedHandler
	implements ICommandHandler<CandidateRejectedCommand> {

	constructor(
		private readonly candidateService: CandidateService,
	) {}

	public async execute(command: CandidateRejectedCommand): Promise<ICandidate> {
		const { id } = command;

		const candidate: ICandidate = await this.candidateService.findOneByIdString(id);
		if (candidate.alreadyHired) {
			throw new ConflictException('The candidate is already hired, you can not reject it');
		}

		try {
			await this.candidateService.update(id,  {
				status: CandidateStatusEnum.REJECTED,
				hiredDate: candidate.rejectDate || new Date()
			});

			return await this.candidateService.findOneByIdString(id);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
