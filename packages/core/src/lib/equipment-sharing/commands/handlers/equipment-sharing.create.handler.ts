import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum, ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingCreateCommand } from '../equipment-sharing.create.command';
import { EquipmentSharingService } from '../../equipment-sharing.service';

@CommandHandler(EquipmentSharingCreateCommand)
export class EquipmentSharingCreateHandler implements ICommandHandler<EquipmentSharingCreateCommand> {
	constructor(
		private readonly _equipmentSharingService: EquipmentSharingService,
		private readonly _requestApprovalService: RequestApprovalService
	) {}

	/**
	 * Executes the creation of a new Equipment Sharing record along with its corresponding Request Approval.
	 *
	 * @param command - The EquipmentSharingCreateCommand containing the equipment sharing data.
	 * @returns A promise that resolves to the newly created EquipmentSharing record.
	 */
	public async execute(command: EquipmentSharingCreateCommand): Promise<EquipmentSharing> {
		// Get current tenant ID from the request context.
		const tenantId = RequestContext.currentTenantId();

		// Destructure the equipment sharing data from the command.
		const { organizationId, input } = command;
		const { name } = input;

		// Create the equipment sharing record.
		const equipmentSharing = await this._equipmentSharingService.create({
			...input,
			organizationId,
			tenantId
		});

		// Create the request approval record for the created equipment sharing.
		await this._requestApprovalService.create({
			name,
			requestId: equipmentSharing.id,
			requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
			status: equipmentSharing.status ?? RequestApprovalStatusTypesEnum.REQUESTED,
			min_count: 1,
			organizationId,
			tenantId
		});

		return equipmentSharing;
	}
}
