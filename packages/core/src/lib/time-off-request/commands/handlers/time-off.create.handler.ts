import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import {
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { TimeOffRequest } from '../../time-off-request.entity';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { TimeOffCreateCommand } from '../time-off.create.command';
import { RequestContext } from '../../../core/context';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';
import { TypeOrmTimeOffRequestRepository } from '../../repository/type-orm-time-off-request.repository';

@CommandHandler(TimeOffCreateCommand)
export class TimeOffCreateHandler implements ICommandHandler<TimeOffCreateCommand> {
	constructor(
		private readonly typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) {}

	public async execute(command?: TimeOffCreateCommand): Promise<TimeOffRequest> {
		try {
			const { timeOff } = command;
			const request = new TimeOffRequest();
			Object.assign(request, timeOff);

			const timeOffRequestSaved = await this.typeOrmTimeOffRequestRepository.save(request);

			const requestApproval = new RequestApproval();
			requestApproval.requestId = timeOffRequestSaved.id;
			requestApproval.requestType = ApprovalPolicyTypesStringEnum.TIME_OFF;
			requestApproval.status = timeOffRequestSaved.status
				? StatusTypesMapRequestApprovalEnum[timeOffRequestSaved.status]
				: RequestApprovalStatusTypesEnum.REQUESTED;
			requestApproval.createdBy = RequestContext.currentUser().id;
			requestApproval.createdByName = RequestContext.currentUser().name;
			requestApproval.name = 'Request time off';
			requestApproval.min_count = 1;

			await this.typeOrmRequestApprovalRepository.save(requestApproval);
			return timeOffRequestSaved;
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
