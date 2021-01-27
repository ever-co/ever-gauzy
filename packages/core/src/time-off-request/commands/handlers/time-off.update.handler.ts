import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import {
	StatusTypesMapRequestApprovalEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { TimeOffRequest } from '../../time-off-request.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context';
import { TimeOffUpdateCommand } from '../time-off.update.command';

@CommandHandler(TimeOffUpdateCommand)
export class TimeOffUpdateHandler
	implements ICommandHandler<TimeOffUpdateCommand> {
	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {}

	public async execute(
		command?: TimeOffUpdateCommand
	): Promise<TimeOffRequest> {
		try {
			const { id, timeOff } = command;
			await this.timeOffRequestRepository.delete(id);
			const timeOffRequestSaved = await this.timeOffRequestRepository.save(
				timeOff
			);

			await this.requestApprovalRepository.delete({
				requestId: id
			});

			const requestApproval = new RequestApproval();
			requestApproval.requestId = timeOffRequestSaved.id;
			requestApproval.status = timeOffRequestSaved.status
				? StatusTypesMapRequestApprovalEnum[timeOffRequestSaved.status]
				: RequestApprovalStatusTypesEnum.REQUESTED;

			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = 'Request time off';
			requestApproval.min_count = 1;
			await this.requestApprovalRepository.save(requestApproval);

			return timeOffRequestSaved;
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
