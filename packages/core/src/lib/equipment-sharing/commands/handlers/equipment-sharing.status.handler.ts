import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { IEquipmentSharing } from '@gauzy/contracts';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { EquipmentSharingStatusCommand } from '../equipment-sharing.status.command';
import { EquipmentSharingService } from '../../equipment-sharing.service';

@CommandHandler(EquipmentSharingStatusCommand)
export class EquipmentSharingStatusHandler implements ICommandHandler<EquipmentSharingStatusCommand> {
	constructor(
		private readonly _equipmentSharingService: EquipmentSharingService,
		private readonly _requestApprovalService: RequestApprovalService
	) {}

	/**
	 * Updates the status of an Equipment Sharing record and its corresponding Request Approval.
	 *
	 * @param command - An object containing the equipment sharing record's ID and the new status.
	 * @returns A promise that resolves to the updated Equipment Sharing record.
	 */
	public async execute(command: EquipmentSharingStatusCommand): Promise<IEquipmentSharing> {
		const { id, status } = command;

		// The equipment sharing record, in the caller's scope.
		const equipmentSharing = await this._equipmentSharingService.findOneByIdString(id);

		// If the equipment sharing record is not found, throw an exception.
		if (!equipmentSharing) {
			throw new NotFoundException('Equipment Sharing not found');
		}

		// Its request approval: the one the filing and the edit record beside the sharing, in the sharing's own
		// organization. `requestId` alone could name another organization's approval of the tenant (a tenant
		// administrator's read is not confined to one organization), since `POST /request-approval` stores the
		// `requestId` it is given.
		const requestApproval = await this._requestApprovalService.findOneByWhereOptions({
			requestId: equipmentSharing.id,
			...(equipmentSharing.organizationId ? { organizationId: equipmentSharing.organizationId } : {})
		});

		if (!requestApproval) {
			throw new NotFoundException('Request Approval not found');
		}

		// The sharing's status and its request approval's, in one transaction. NOT update(): that one deletes the
		// row and re-inserts the payload, so approving/refusing (a { status }-only body) replaced the record with a
		// stub. The sharing's status is a compare-and-set on the version read, answered 409 when the record changed
		// in between, and the approval is written on the same transaction, under the locks it holds: a concurrent
		// decision can no longer land between the two writes and leave the rows disagreeing. The approval is the one
		// read above, in the caller's scope, locked and written by its own id: another organization's approval that
		// carries the same `requestId` is not touched, and one that is gone by then refuses the decision (404).
		return await this._equipmentSharingService.decideWithRequestApproval(id, status, requestApproval.id);
	}
}
