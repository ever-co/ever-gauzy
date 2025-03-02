import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { RequestApprovalStatusTypesEnum, ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { EquipmentSharing } from '../../equipment-sharing.entity';
import { EquipmentSharingCreateCommand } from '../equipment-sharing.create.command';
import { RequestApproval } from '../../../request-approval/request-approval.entity';
import { RequestContext } from '../../../core/context';
import { TypeOrmEquipmentSharingRepository } from '../../repository/type-orm-equipment-sharing.repository';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';

@CommandHandler(EquipmentSharingCreateCommand)
export class EquipmentSharingCreateHandler implements ICommandHandler<EquipmentSharingCreateCommand> {
	constructor(
		private readonly typeOrmEquipmentSharingRepository: TypeOrmEquipmentSharingRepository,
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) {}

	public async execute(command?: EquipmentSharingCreateCommand): Promise<EquipmentSharing> {
		const { orgId, equipmentSharing } = command;
		equipmentSharing.createdBy = RequestContext.currentUser().id;
		equipmentSharing.createdByName = RequestContext.currentUser().name;
		equipmentSharing.organizationId = orgId;
		const equipmentSharingSaved = await this.typeOrmEquipmentSharingRepository.save(equipmentSharing);

		const requestApproval = new RequestApproval();
		requestApproval.requestId = equipmentSharingSaved.id;
		requestApproval.requestType = ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING;
		requestApproval.status = equipmentSharingSaved.status
			? equipmentSharingSaved.status
			: RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.createdBy = RequestContext.currentUser().id;
		requestApproval.createdByName = RequestContext.currentUser().name;
		requestApproval.name = equipmentSharing.name;
		requestApproval.min_count = 1;
		await this.typeOrmRequestApprovalRepository.save(requestApproval);

		return equipmentSharingSaved;
	}
}
