import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum, ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingCreateCommand } from '../equipment-sharing.create.command';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';
import { EquipmentSharingService } from '../../equipment-sharing.service';

@CommandHandler(EquipmentSharingCreateCommand)
export class EquipmentSharingCreateHandler implements ICommandHandler<EquipmentSharingCreateCommand> {
	constructor(
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,
		private readonly equipmentSharingService: EquipmentSharingService
	) {}

	/**
	 * Executes the creation of a new Equipment Sharing record along with its corresponding Request Approval.
	 *
	 * @param command - The EquipmentSharingCreateCommand containing the equipment sharing data.
	 * @returns A promise that resolves to the newly created EquipmentSharing record.
	 */
	public async execute(command: EquipmentSharingCreateCommand): Promise<EquipmentSharing> {
		// Get current user details once to avoid multiple calls.
		const currentUser = RequestContext.currentUser();

		// Destructure the equipment sharing data from the command.
		const { equipmentSharing } = command;
		// Set the creator of the equipment sharing record using the current user ID.
		equipmentSharing.createdByUserId = RequestContext.currentUserId();
		// Create the equipment sharing record.
		const equipmentSharingSaved = await this.equipmentSharingService.create(equipmentSharing);

		// Build the request approval record for the created equipment sharing.
		const requestApproval = new RequestApproval();
		requestApproval.requestId = equipmentSharingSaved.id;
		requestApproval.requestType = ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING;
		requestApproval.status = equipmentSharingSaved.status ?? RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.createdBy = currentUser.id;
		requestApproval.createdByName = currentUser.name;
		requestApproval.name = equipmentSharing.name;
		requestApproval.min_count = 1;

		// Save the request approval record.
		await this.typeOrmRequestApprovalRepository.save(requestApproval);

		return equipmentSharingSaved;
	}
}
