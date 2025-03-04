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

		// Retrieve the equipment sharing record and its associated request approval concurrently.
		const [equipmentSharing, requestApproval] = await Promise.all([
			this._equipmentSharingService.findOneByIdString(id),
			this._requestApprovalService.findOneByWhereOptions({ requestId: id })
		]);

		// If the equipment sharing record is not found, throw an exception.
		if (!equipmentSharing) {
			throw new NotFoundException('Equipment Sharing not found');
		}

		if (!requestApproval) {
			throw new NotFoundException('Request Approval not found');
		}

		// If a corresponding request approval exists, update its status as well.
		await this._requestApprovalService.update({ requestId: id }, { status });

		// Persist and return the updated equipment sharing record.
		return await this._equipmentSharingService.update(id, { status });
	}
}
