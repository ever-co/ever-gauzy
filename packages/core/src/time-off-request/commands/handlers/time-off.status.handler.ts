import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import {
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum
} from '@gauzy/contracts';
import { TimeOffStatusCommand } from '../time-off.status.command';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TimeOffRequest } from '../../time-off-request.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { Repository } from 'typeorm';

@CommandHandler(TimeOffStatusCommand)
export class TimeOffStatusHandler
	implements ICommandHandler<TimeOffStatusCommand> {
	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {}

	public async execute(
		command?: TimeOffStatusCommand
	): Promise<TimeOffRequest> {
		const { id, status } = command;

		const [timeOffRequest, requestApproval] = await Promise.all([
			await this.timeOffRequestRepository.findOne(id),
			await this.requestApprovalRepository.findOne({
				requestId: id
			})
		]);

		if (!timeOffRequest) {
			throw new NotFoundException('Request time off not found');
		}

		timeOffRequest.status = status;
		if (requestApproval) {
			requestApproval.status = StatusTypesMapRequestApprovalEnum[status];
			await this.requestApprovalRepository.save(requestApproval);
		}

		return await this.timeOffRequestRepository.save(timeOffRequest);
	}
}
