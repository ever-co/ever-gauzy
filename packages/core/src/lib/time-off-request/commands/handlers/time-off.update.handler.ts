import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { StatusTypesMapRequestApprovalEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { TimeOffRequest } from '../../time-off-request.entity';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { TimeOffUpdateCommand } from '../time-off.update.command';
import { TypeOrmTimeOffRequestRepository } from '../../repository/type-orm-time-off-request.repository';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';

@CommandHandler(TimeOffUpdateCommand)
export class TimeOffUpdateHandler implements ICommandHandler<TimeOffUpdateCommand> {
	constructor(
		private readonly typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) {}

	public async execute(command?: TimeOffUpdateCommand): Promise<TimeOffRequest> {
		try {
			const { id, timeOff } = command;
			await this.typeOrmTimeOffRequestRepository.delete(id);

			const timeOffRequestSaved = await this.typeOrmTimeOffRequestRepository.save(timeOff);

			await this.typeOrmRequestApprovalRepository.delete({ requestId: id });

			const requestApproval = new RequestApproval();
			requestApproval.requestId = timeOffRequestSaved.id;
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
