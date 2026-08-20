import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
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
		const { id, input } = command;

		// Read the row BEFORE destroying it: this is a delete-then-recreate, so the scope it is
		// recreated in has to come from the record rather than from the request. `findOneByIdString`
		// is tenant-scoped and throws NotFoundException, which also stops an unknown id being
		// recreated as a brand-new row.
		const existing = await this._equipmentSharingService.findOneByIdString(id);

		// Delete the existing Equipment Sharing record and its associated Request Approval concurrently.
		await Promise.all([
			this._equipmentSharingService.delete(id),
			this._requestApprovalService.delete({ requestId: id })
		]);

		// Save the updated Equipment Sharing record under the path id (a body-supplied id must not
		// re-point the write at another row; the raw body is not DTO-validated). The organization is
		// pinned from the stored row for the same reason: nothing checks a body `organizationId`
		// against the caller's organizations, so an update could otherwise move the record.
		const equipmentSharing = await this._equipmentSharingService.create({
			...input,
			id,
			organizationId: existing.organizationId,
			tenantId: existing.tenantId
		});

		// Create a new request approval record for the updated equipment sharing.
		await this._requestApprovalService.create({
			requestId: equipmentSharing.id,
			status: equipmentSharing.status ?? RequestApprovalStatusTypesEnum.REQUESTED,
			name: equipmentSharing.name,
			min_count: 1
		});

		return equipmentSharing;
	}
}
