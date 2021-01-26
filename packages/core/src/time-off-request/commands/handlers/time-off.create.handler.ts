import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import {
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { TimeOffRequest } from '../../time-off-request.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { Repository } from 'typeorm';
import { TimeOffCreateCommand } from '../time-off.create.command';
import { RequestContext } from '../../../core/context';

@CommandHandler(TimeOffCreateCommand)
export class TimeOffCreateHandler
	implements ICommandHandler<TimeOffCreateCommand> {
	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {}

	public async execute(
		command?: TimeOffCreateCommand
	): Promise<TimeOffRequest> {
		try {
			const { timeOff } = command;
			const request = new TimeOffRequest();
			Object.assign(request, timeOff);

			const timeOffRequestSaved = await this.timeOffRequestRepository.save(
				request
			);

			const requestApproval = new RequestApproval();
			requestApproval.requestId = timeOffRequestSaved.id;
			requestApproval.requestType =
				ApprovalPolicyTypesStringEnum.TIME_OFF;
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
