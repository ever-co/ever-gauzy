import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import {
	StatusTypesMapRequestApprovalEnum,
	ApprovalPolicyTypesStringEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { TimeOffRequest } from '../../time-off-request.entity';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { TimeOffCreateCommand } from '../time-off.create.command';
import { RequestContext } from '../../../core/context';
import { TimeOffRequestService } from '../../time-off-request.service';

@CommandHandler(TimeOffCreateCommand)
export class TimeOffCreateHandler implements ICommandHandler<TimeOffCreateCommand> {
	constructor(
		private readonly _timeOffRequestService: TimeOffRequestService,
		private readonly _requestApprovalService: RequestApprovalService
	) {}

	/**
	 * Executes the time off update command.
	 *
	 * @param command - The command containing the time off request data.
	 * @returns The saved TimeOffRequest entity.
	 */
	public async execute(command: TimeOffCreateCommand): Promise<TimeOffRequest> {
		const { input } = command;

		// Create the request approval record for the created equipment sharing.
		const timeOffRequest = await this._timeOffRequestService.create(input);

		// Create the request approval record for the created equipment sharing.
		await this._requestApprovalService.create({
			requestId: timeOffRequest.id,
			requestType: ApprovalPolicyTypesStringEnum.TIME_OFF,
			status: timeOffRequest.status
				? StatusTypesMapRequestApprovalEnum[timeOffRequest.status]
				: RequestApprovalStatusTypesEnum.REQUESTED,
			name: 'Request time off',
			min_count: 1
		});

		return timeOffRequest;
	}
}
