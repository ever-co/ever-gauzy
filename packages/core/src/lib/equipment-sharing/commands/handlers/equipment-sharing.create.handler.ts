import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum, ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { RequestApprovalService } from '../../../request-approval/request-approval.service';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingCreateCommand } from '../equipment-sharing.create.command';
import { EquipmentSharingService } from '../../equipment-sharing.service';
import { filedSharingStatus, SHARING_DECISION_PERMISSIONS } from '../../filed-status.helper';
import { withReferencesAsIds } from '../../reference-scope.helper';

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

		// The row stores one equipment and one policy: the related object's id when the body carries one (the form
		// sends both), so the status below and the scope check read the rows the row will point at. The objects are
		// dropped: a policy named as `equipmentSharingPolicy: { id }` was persisted without ever being checked.
		const values = withReferencesAsIds(input);
		const { equipmentId } = values;
		const scope = { tenantId, organizationId };

		// The equipment and the policy the body names must be this organization's (as on the update path).
		await this._equipmentSharingService.assertReferencesAreInScope(values, scope);

		// Only a caller who may decide a sharing chooses its status; anyone else's request is approved only when the
		// equipment itself auto-approves its shares.
		const status = await filedSharingStatus(
			input.status,
			RequestContext.hasAnyPermission([...SHARING_DECISION_PERMISSIONS]),
			() => this._equipmentSharingService.autoApprovesShare(equipmentId, scope)
		);

		// Create the equipment sharing record.
		const equipmentSharing = await this._equipmentSharingService.create({
			...values,
			equipmentId,
			status,
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
