import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingUpdateCommand } from '../equipment-sharing.update.command';
import { EquipmentSharingService } from '../../equipment-sharing.service';

@CommandHandler(EquipmentSharingUpdateCommand)
export class EquipmentSharingUpdateHandler implements ICommandHandler<EquipmentSharingUpdateCommand> {
	constructor(
		private readonly _equipmentSharingService: EquipmentSharingService,
		private readonly _requestApprovalService: RequestApprovalService
	) {}

	/**
	 * Executes an update for an Equipment Sharing record.
	 *
	 * @param command - The EquipmentSharingUpdateCommand containing the record's ID and the updated equipment sharing data.
	 * @returns A promise that resolves to the updated EquipmentSharing record.
	 */
	public async execute(command: EquipmentSharingUpdateCommand): Promise<EquipmentSharing> {
		// Get the current tenant ID and current user ID from the request context.
		const createdByUserId = RequestContext.currentUserId();

		const { id, input } = command;

		// Delete the existing Equipment Sharing record and its associated Request Approval concurrently.
		await Promise.all([
			this._equipmentSharingService.delete(id),
			this._requestApprovalService.delete({ requestId: id })
		]);

		// Save the updated Equipment Sharing record.
		const equipmentSharing = await this._equipmentSharingService.create(input);

		// Create a new request approval record for the updated equipment sharing.
		await this._requestApprovalService.create({
			requestId: equipmentSharing.id,
			status: equipmentSharing.status ?? RequestApprovalStatusTypesEnum.REQUESTED,
			createdByUserId,
			name: equipmentSharing.name,
			min_count: 1
		});

		return equipmentSharing;
	}
}
