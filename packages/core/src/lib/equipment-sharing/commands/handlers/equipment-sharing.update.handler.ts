import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { EquipmentSharingUpdateCommand } from '../equipment-sharing.update.command';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';
import { EquipmentSharingService } from '../../equipment-sharing.service';

@CommandHandler(EquipmentSharingUpdateCommand)
export class EquipmentSharingUpdateHandler implements ICommandHandler<EquipmentSharingUpdateCommand> {
	constructor(
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,
		private readonly equipmentSharingService: EquipmentSharingService
	) {}

	/**
	 * Executes an update for an Equipment Sharing record.
	 *
	 * @param command - The EquipmentSharingUpdateCommand containing the record's ID and the updated equipment sharing data.
	 * @returns A promise that resolves to the updated EquipmentSharing record.
	 */
	public async execute(command: EquipmentSharingUpdateCommand): Promise<EquipmentSharing> {
		const { id, equipmentSharing } = command;

		const currentUser = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		// Delete the existing Equipment Sharing record and its associated Request Approval concurrently.
		await Promise.all([
			this.equipmentSharingService.delete(id),
			this.typeOrmRequestApprovalRepository.delete({ requestId: id })
		]);

		// Save the updated Equipment Sharing record.
		equipmentSharing.tenantId = tenantId;
		const equipmentSharingSaved = await this.equipmentSharingService.create(equipmentSharing);

		// Create a new Request Approval record for the updated Equipment Sharing.
		const requestApproval = new RequestApproval();
		requestApproval.requestId = equipmentSharingSaved.id;
		requestApproval.status = equipmentSharingSaved.status ?? RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.createdBy = currentUser.id;
		requestApproval.createdByName = currentUser.name;
		requestApproval.name = equipmentSharing.name;
		requestApproval.min_count = 1;
		requestApproval.tenantId = tenantId;

		// Save the new Request Approval.
		await this.typeOrmRequestApprovalRepository.save(requestApproval);

		return equipmentSharingSaved;
	}
}
