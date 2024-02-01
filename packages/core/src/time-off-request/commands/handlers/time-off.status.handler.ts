import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { TimeOffStatusCommand } from '../time-off.status.command';
import { TimeOffRequest } from '../../time-off-request.entity';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { TypeOrmTimeOffRequestRepository } from '../../repository/type-orm-time-off-request.repository';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';

@CommandHandler(TimeOffStatusCommand)
export class TimeOffStatusHandler implements ICommandHandler<TimeOffStatusCommand> {

	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,

		@InjectRepository(RequestApproval)
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) { }

	public async execute(
		command?: TimeOffStatusCommand
	): Promise<TimeOffRequest> {
		const { id, status } = command;

		const [timeOffRequest, requestApproval] = await Promise.all([
			await this.typeOrmTimeOffRequestRepository.findOneBy({ id }),
			await this.typeOrmRequestApprovalRepository.findOneBy({
				requestId: id
			})
		]);

		if (!timeOffRequest) {
			throw new NotFoundException('Request time off not found');
		}

		timeOffRequest.status = status;
		if (requestApproval) {
			requestApproval.status = StatusTypesMapRequestApprovalEnum[status];
			await this.typeOrmRequestApprovalRepository.save(requestApproval);
		}

		return await this.typeOrmTimeOffRequestRepository.save(timeOffRequest);
	}
}
