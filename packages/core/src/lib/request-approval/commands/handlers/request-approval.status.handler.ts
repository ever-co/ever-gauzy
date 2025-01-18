import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusCommand } from '../request-approval.status.command';
import { RequestApproval } from '../../request-approval.entity';
import { RequestApprovalService } from '../../request-approval.service';
import { EquipmentSharingService } from '../../../equipment-sharing';
import { ApprovalPolicyTypesStringEnum, StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { TimeOffRequestService } from '../../../time-off-request/time-off-request.service';

@CommandHandler(RequestApprovalStatusCommand)
export class RequestApprovalStatusHandler implements ICommandHandler<RequestApprovalStatusCommand> {
	constructor(
		private requestApprovalService: RequestApprovalService,
		private equipmentSharingService: EquipmentSharingService,
		private timeOffRequestService: TimeOffRequestService
	) {}

	public async execute(command?: RequestApprovalStatusCommand): Promise<RequestApproval> {
		const { requestApprovalId, status } = command;

		const requestApproval = await this.requestApprovalService.updateStatusRequestApprovalByAdmin(
			requestApprovalId,
			status
		);

		if (requestApproval.requestType === ApprovalPolicyTypesStringEnum.TIME_OFF) {
			const timeOffStatus = StatusTypesMapRequestApprovalEnum[status];
			await this.timeOffRequestService.updateStatusTimeOffByAdmin(requestApproval.requestId, timeOffStatus);
		} else if (requestApproval.requestType === ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING) {
			await this.equipmentSharingService.updateStatusEquipmentSharingByAdmin(requestApproval.requestId, status);
		}

		return requestApproval;
	}
}
