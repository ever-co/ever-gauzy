import { ConflictException } from '@nestjs/common';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusCommand } from '../request-approval.status.command';
import { RequestApproval } from '../../request-approval.entity';
import { RequestApprovalService } from '../../request-approval.service';
import { EquipmentSharingService } from '../../../equipment-sharing';
import { ApprovalPolicyTypesStringEnum, ID, StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { TimeOffRequestService } from '../../../time-off-request/time-off-request.service';
import { RequestApprovalVerdict } from '../../request-approval-decision';
import { assertMayDecideLinkedDocument } from '../../linked-document-decision.gate';

/**
 * Answers a request approval: `PUT /request-approval/approval/:id`, `PUT /request-approval/refuse/:id`, and the
 * GraphQL `approveRequestApproval` / `refuseRequestApproval` that dispatch the same command.
 *
 * The routes are open to `REQUEST_APPROVAL_EDIT`, which every employee holds, so the handler decides who may
 * answer: a designated approver of the request (their own employee slot, or an approver team they belong to) or a
 * tenant administrator; `min_count` decides when approvers' approvals approve the request; a decided request is a
 * conflict except to an administrator deciding it the other way (see `request-approval-decision.ts`).
 *
 * When the answer decides the request, the time-off request or equipment sharing it is about moves with it — and
 * only for a caller who could move that document through its own approve/refuse route, because this command is a
 * second door onto the same state change. The gate is checked and the document moved before the answer is
 * written, so a refusal (403, or the document's own 409) leaves the request exactly as it was. An answer whose
 * writes failed after the document moved can be sent again: see {@link moveTimeOff}.
 */
@CommandHandler(RequestApprovalStatusCommand)
export class RequestApprovalStatusHandler implements ICommandHandler<RequestApprovalStatusCommand> {
	constructor(
		private requestApprovalService: RequestApprovalService,
		private equipmentSharingService: EquipmentSharingService,
		private timeOffRequestService: TimeOffRequestService
	) {}

	public async execute(command?: RequestApprovalStatusCommand): Promise<RequestApproval> {
		const { requestApprovalId, status } = command;

		const answer = await this.requestApprovalService.prepareAnswer(
			requestApprovalId,
			status as RequestApprovalVerdict
		);
		const { requestApproval, outcome } = answer;

		if (outcome.settles) {
			assertMayDecideLinkedDocument(requestApproval.requestType);

			if (requestApproval.requestType === ApprovalPolicyTypesStringEnum.TIME_OFF) {
				const timeOffStatus = StatusTypesMapRequestApprovalEnum[outcome.status];
				await this.moveTimeOff(requestApproval.requestId, timeOffStatus);
			} else if (requestApproval.requestType === ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING) {
				await this.equipmentSharingService.updateStatusEquipmentSharingByAdmin(
					requestApproval.requestId,
					outcome.status
				);
			}
		}

		return await this.requestApprovalService.recordAnswer(answer);
	}

	/**
	 * Moves the time-off request a decision is about.
	 *
	 * The time-off service refuses (409) a leave that is no longer `REQUESTED`. A leave can already carry the
	 * status this decision gives it: an earlier attempt moved it and then failed to write its answer, or the leave
	 * was decided through its own route. The answer is written then, instead of being refused on every retry; the
	 * slot and status writes of `recordAnswer` set the same values again. Any other conflict stands, such as an
	 * administrator deciding an approved leave the other way.
	 *
	 * @param id The time-off request.
	 * @param status The status the decision gives it.
	 * @throws ConflictException when the leave was decided otherwise.
	 */
	private async moveTimeOff(id: ID, status: string): Promise<void> {
		try {
			await this.timeOffRequestService.updateStatusTimeOffByAdmin(id, status);
		} catch (error) {
			if (error instanceof ConflictException) {
				const timeOff = await this.timeOffRequestService.findOneByIdString(id);
				if (timeOff?.status === status) {
					return;
				}
			}
			throw error;
		}
	}
}
